/**
 * The two programs the desktop app runs, put where Tauri wants them
 * (src-tauri/binaries/<name>-<target triple>[.exe]):
 * - `ak-server`: the realtime server as one executable (Node SEA), built here;
 * - `cloudflared`: Cloudflare's tunnel client, downloaded from its release
 *   and checked against the SHA-256 Cloudflare publishes.
 *
 * The target is the Rust host's, or `TARGET_TRIPLE`.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CLOUDFLARED_VERSION = "2026.10.7";
/** Per target: the release asset and its SHA-256 (from the release notes). */
const CLOUDFLARED = {
  "x86_64-unknown-linux-gnu": {
    asset: "cloudflared-linux-amd64",
    sha256: "1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872",
  },
  "aarch64-unknown-linux-gnu": {
    asset: "cloudflared-linux-arm64",
    sha256: "3df43aedc9ff291d1735b5cb576cb97e0b157488796db2e32b28aecabb445775",
  },
  "x86_64-pc-windows-msvc": {
    asset: "cloudflared-windows-amd64.exe",
    sha256: "2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343",
  },
  "aarch64-apple-darwin": {
    asset: "cloudflared-darwin-arm64.tgz",
    sha256: "3586ccf397e98e5f437e60e7c307ca6ac463e110580503af8bb8e6f9ebf831bd",
  },
  "x86_64-apple-darwin": {
    asset: "cloudflared-darwin-amd64.tgz",
    sha256: "02f3edfd87684dd5b705607688e4eb4b323f6e777b81e7b3a85af556aa356848",
  },
};

const here = import.meta.dirname;
const binaries = path.resolve(here, "../src-tauri/binaries");
const serverDir = path.resolve(here, "../../realtime-server");

const triple =
  process.env.TARGET_TRIPLE ||
  /^host: (\S+)$/m.exec(execFileSync("rustc", ["-vV"], { encoding: "utf8" }))?.[1];
if (!triple || !(triple in CLOUDFLARED)) {
  throw new Error(`Unsupported target: ${triple ?? "unknown"} (see CLOUDFLARED)`);
}
const ext = triple.includes("windows") ? ".exe" : "";
mkdirSync(binaries, { recursive: true });

// --- ak-server --------------------------------------------------------------------
execFileSync(process.execPath, [path.join(serverDir, "scripts/build-sea.mjs")], {
  stdio: "inherit",
});
copyFileSync(
  path.join(serverDir, `dist/sea/ak-server${ext}`),
  path.join(binaries, `ak-server-${triple}${ext}`),
);

// --- cloudflared ------------------------------------------------------------------
const target = path.join(binaries, `cloudflared-${triple}${ext}`);
const { asset, sha256 } = CLOUDFLARED[triple];
const sum = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

if (!(existsSync(target) && !asset.endsWith(".tgz") && (await sum(target)) === sha256)) {
  const url = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/${asset}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const work = mkdtempSync(path.join(tmpdir(), "cloudflared-"));
  const downloaded = path.join(work, asset);
  writeFileSync(downloaded, Buffer.from(await response.arrayBuffer()));
  const actual = await sum(downloaded);
  if (actual !== sha256) throw new Error(`${asset}: SHA-256 ${actual}, expected ${sha256}`);
  if (asset.endsWith(".tgz")) {
    execFileSync("tar", ["-xzf", downloaded, "-C", work]);
    copyFileSync(path.join(work, "cloudflared"), target);
  } else copyFileSync(downloaded, target);
  chmodSync(target, 0o755);
}
process.stdout.write(`Sidecars ready for ${triple} in ${path.relative(process.cwd(), binaries)}\n`);
