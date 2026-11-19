/**
 * The server as one executable, Node included (Node's « single executable
 * application »), for the desktop app: dist/sea/ak-server[.exe]. Built on
 * each platform for itself (CI matrix): a SEA is the running Node binary
 * with the bundle inside.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist/sea");
mkdirSync(out, { recursive: true });

// A SEA runs CommonJS: the same bundle as `build`, in that format.
await build({
  entryPoints: [path.join(root, "src/server.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node26",
  outfile: path.join(out, "server.cjs"),
  logLevel: "warning",
});

const exe = path.join(out, process.platform === "win32" ? "ak-server.exe" : "ak-server");
const config = path.join(out, "sea-config.json");
writeFileSync(
  config,
  JSON.stringify({
    main: path.join(out, "server.cjs"),
    output: exe,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
  }),
);
execFileSync(process.execPath, ["--build-sea", config], { stdio: "inherit" });

// macOS runs only signed binaries: an ad-hoc signature, the app bundle's own
// signature (if any) covering it afterwards.
if (process.platform === "darwin") {
  execFileSync("codesign", ["--sign", "-", "--force", exe], { stdio: "inherit" });
}
process.stdout.write(`SEA: ${path.relative(process.cwd(), exe)}\n`);
