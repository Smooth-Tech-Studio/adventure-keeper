// The window of Adventure Keeper Serveur: shows what the server reports
// (`server-status` events, the last one through `last_status` on load).
// The site it opens is the build's (`open_site`): production or staging.

const STRINGS = {
  fr: {
    subtitle: "Serveur de session en direct",
    address: "Adresse pour vos joueurs",
    copy: "Copier",
    copied: "Copié",
    howTitle: "Lancer une séance",
    step1:
      "Sur Adventure Keeper, ouvrez l'aventure, puis le bouton serveur à côté de « Démarrer la session ».",
    step2: "L'adresse est détectée toute seule sur cet ordinateur (sinon, collez-la).",
    step3: "Démarrez la session : les joueurs n'ont rien à installer.",
    keepOpen: "Gardez cette fenêtre ouverte pendant la séance : la fermer arrête le serveur.",
    openSite: "Ouvrir Adventure Keeper",
    starting: "Démarrage du serveur…",
    tunnel: "Ouverture de l'adresse publique…",
    ready: "Serveur prêt",
    error: "Le serveur ne répond plus",
    tunnelError: "Adresse publique indisponible",
    tunnelHint: "Vérifiez la connexion à Internet, puis relancez l'application.",
    portInUse: "Le port 8787 est déjà pris : l'application tourne peut-être déjà.",
    players: (players, rooms) =>
      players === 0
        ? "Personne n'est connecté pour l'instant."
        : `${players} connexion${players > 1 ? "s" : ""} · ${rooms} séance${rooms > 1 ? "s" : ""}`,
  },
  en: {
    subtitle: "Live session server",
    address: "Address for your players",
    copy: "Copy",
    copied: "Copied",
    howTitle: "Run a session",
    step1:
      "On Adventure Keeper, open the adventure, then the server button next to “Start session”.",
    step2: "The address is found on its own on this computer (otherwise, paste it).",
    step3: "Start the session: players have nothing to install.",
    keepOpen: "Keep this window open during the session: closing it stops the server.",
    openSite: "Open Adventure Keeper",
    starting: "Starting the server…",
    tunnel: "Opening the public address…",
    ready: "Server ready",
    error: "The server stopped",
    tunnelError: "Public address unavailable",
    tunnelHint: "Check the Internet connection, then restart the app.",
    portInUse: "Port 8787 is already taken: the app may already be running.",
    players: (players, rooms) =>
      players === 0
        ? "Nobody is connected yet."
        : `${players} connection${players > 1 ? "s" : ""} · ${rooms} session${rooms > 1 ? "s" : ""}`,
  },
};

const lang = navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
const t = STRINGS[lang];
document.documentElement.lang = lang;
for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t[el.dataset.i18n];

const $ = (id) => document.getElementById(id);
const tauri = window.__TAURI__;

function render(status) {
  const server = status?.server ?? { status: "starting" };
  const tunnel = status?.tunnel ?? { status: "off" };
  let tone = "busy";
  let label = t.starting;
  let detail = "";

  if (server.status === "error") {
    tone = "error";
    label = t.error;
    detail = server.message?.includes("in use") ? t.portInUse : (server.message ?? "");
  } else if (server.status === "ready" && tunnel.status === "ready") {
    tone = "ok";
    label = t.ready;
  } else if (server.status === "ready" && tunnel.status === "error") {
    tone = "error";
    label = t.tunnelError;
    detail = t.tunnelHint;
  } else if (server.status === "ready") {
    label = t.tunnel;
  }

  $("dot").dataset.tone = tone;
  $("status-label").textContent = label;
  $("status-detail").textContent = detail;
  $("status-detail").dataset.tone = tone;
  $("status-detail").hidden = !detail;

  const url = tunnel.status === "ready" ? tunnel.url : "";
  $("address").value = url;
  $("copy").disabled = !url;
  $("players").textContent =
    server.status === "ready" ? t.players(status.players ?? 0, status.rooms ?? 0) : "";
}

$("copy").addEventListener("click", async () => {
  const value = $("address").value;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    $("address").select();
    document.execCommand("copy");
  }
  $("copy").textContent = t.copied;
  setTimeout(() => ($("copy").textContent = t.copy), 1500);
});

$("open-site").addEventListener("click", () => {
  // Outside the app (a preview of the window in a browser) there is no site to open.
  if (tauri) void tauri.core.invoke("open_site");
});

render(null);
if (tauri) {
  tauri.event.listen("server-status", (event) => render(JSON.parse(event.payload)));
  tauri.core.invoke("last_status").then((last) => last && render(JSON.parse(last)));
}
