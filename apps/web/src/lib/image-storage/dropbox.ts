/**
 * Dropbox as the image store: the player connects their own account once
 * (OAuth 2 with PKCE, straight from the browser — no server, no secret), and
 * every image they import is uploaded to the app's folder in their Dropbox
 * (`Applications/<app>/images/…`) and shared by a public link, which the map,
 * the portrait or the handout then points at.
 *
 * The app is registered once in the Dropbox App Console (« Scoped access »,
 * « App folder »); its key goes in `VITE_DROPBOX_APP_KEY`. Without it, the
 * feature does not show. See docs/IMAGE_STORAGE.md.
 */

import type { StorageConnection } from "@/lib/image-storage/types";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";
const CONTENT_API = "https://content.dropboxapi.com/2";
/** What the app may do: write files, share them, and say whose account it is. */
const SCOPES = "files.content.write sharing.write account_info.read";
/** Where Dropbox sends the player back (a route of the app). */
export const DROPBOX_CALLBACK_PATH = "/stockage/dropbox";
const PENDING_KEY = "dropbox-connect";

export const dropboxAppKey = (): string | undefined =>
  import.meta.env.VITE_DROPBOX_APP_KEY || undefined;

const redirectUri = () => `${window.location.origin}${DROPBOX_CALLBACK_PATH}`;

function base64Url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A PKCE pair: the verifier kept here, its SHA-256 sent to Dropbox. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/**
 * Leave for Dropbox's consent page. The verifier and the page to come back to
 * wait in this tab's session storage.
 */
export async function startDropboxConnect(returnTo: string): Promise<void> {
  const key = dropboxAppKey();
  if (!key) throw new Error("VITE_DROPBOX_APP_KEY is not set");
  const { verifier, challenge } = await pkcePair();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, returnTo }));
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: key,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
    scope: SCOPES,
    state,
  }).toString();
  window.location.assign(url.toString());
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/** Tries at the token endpoint when Dropbox answers « too many requests ». */
const TOKEN_TRIES = 3;
/** Longest wait between two tries, whatever `Retry-After` asks. */
const MAX_RETRY_WAIT_MS = 10_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Dropbox's own words for a refusal (`error_description`), else the raw body. */
async function errorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error_description?: string; error?: unknown };
    return body.error_description ?? JSON.stringify(body.error ?? body);
  } catch {
    return text.slice(0, 200);
  }
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (response.ok) return (await response.json()) as TokenResponse;
    // Rate limited: wait as long as Dropbox asks (within reason), then again.
    if (response.status === 429 && attempt < TOKEN_TRIES) {
      const seconds = Number(response.headers.get("Retry-After"));
      await wait(Math.min(MAX_RETRY_WAIT_MS, seconds > 0 ? seconds * 1000 : 1000 * attempt));
      continue;
    }
    throw new Error(`Dropbox token: ${response.status} — ${await errorDetail(response)}`);
  }
}

async function api<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body === null ? "null" : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Dropbox ${path}: ${response.status}`) as Error & { detail?: string };
    error.detail = await response.text();
    throw error;
  }
  return (await response.json()) as T;
}

/**
 * Back from Dropbox with `?code=…&state=…`: trade the code for the tokens, and
 * read whose account it is. Returns where to go next.
 */
export async function finishDropboxConnect(
  search: URLSearchParams,
): Promise<{ connection: StorageConnection; returnTo: string }> {
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as {
    verifier: string;
    state: string;
    returnTo: string;
  } | null;
  sessionStorage.removeItem(PENDING_KEY);
  const code = search.get("code");
  if (!pending || !code || search.get("state") !== pending.state) {
    throw new Error(search.get("error_description") ?? "Dropbox: connexion interrompue");
  }
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    client_id: dropboxAppKey() ?? "",
    code_verifier: pending.verifier,
    redirect_uri: redirectUri(),
  });
  const account = await api<{ email: string; name: { display_name: string } }>(
    "/users/get_current_account",
    tokens.access_token,
    null,
  );
  return {
    returnTo: pending.returnTo,
    connection: {
      provider: "dropbox",
      refreshToken: tokens.refresh_token ?? "",
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      accountName: account.name.display_name,
      accountEmail: account.email,
    },
  };
}

/** A usable access token, refreshed when it has (nearly) expired. */
export async function freshConnection(connection: StorageConnection): Promise<StorageConnection> {
  if (connection.accessToken && connection.expiresAt > Date.now() + 60_000) return connection;
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: dropboxAppKey() ?? "",
  });
  return {
    ...connection,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

/** `Carte de la crypte (v2).PNG` → `carte-de-la-crypte-v2.png`. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "";
  return `${base || "image"}${ext ? `.${ext}` : ""}`;
}

/** A shared link turned into the image's own bytes (`raw=1`), for `<img src>`. */
export function directLink(sharedUrl: string): string {
  const url = new URL(sharedUrl);
  url.searchParams.delete("dl");
  url.searchParams.set("raw", "1");
  return url.toString();
}

/**
 * Upload an image to the app's folder and return a public direct link to it.
 * The connection comes back too: its token may have been refreshed.
 */
export async function uploadToDropbox(
  connection: StorageConnection,
  file: File,
  now = new Date(),
): Promise<{ url: string; connection: StorageConnection }> {
  const fresh = await freshConnection(connection);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const path = `/images/${month}/${now.getTime().toString(36)}-${safeFileName(file.name)}`;
  const uploadResponse = await fetch(`${CONTENT_API}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Content-Type": "application/octet-stream",
      // Header values must be ASCII: the path is, by construction.
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true }),
    },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error(`Dropbox upload: ${uploadResponse.status}`);
  const uploaded = (await uploadResponse.json()) as { path_lower: string };

  let shared: string;
  try {
    shared = (
      await api<{ url: string }>("/sharing/create_shared_link_with_settings", fresh.accessToken, {
        path: uploaded.path_lower,
        settings: { requested_visibility: "public", audience: "public", access: "viewer" },
      })
    ).url;
  } catch (error) {
    // Already shared (a second upload of the same path): reuse that link.
    if (!String((error as { detail?: string }).detail).includes("shared_link_already_exists"))
      throw error;
    const links = await api<{ links: { url: string }[] }>(
      "/sharing/list_shared_links",
      fresh.accessToken,
      { path: uploaded.path_lower, direct_only: true },
    );
    shared = links.links[0].url;
  }
  return { url: directLink(shared), connection: fresh };
}
