import { spawn, type ChildProcess } from "node:child_process";

/** A Cloudflare quick tunnel's address, as cloudflared prints it. */
// `api.trycloudflare.com` (in its errors) is the service, not a tunnel.
const QUICK_TUNNEL_URL = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;

/** The quick tunnel's address in a chunk of cloudflared's log, if any. */
export function findTunnelUrl(log: string): string | null {
  return QUICK_TUNNEL_URL.exec(log)?.[0] ?? null;
}

export type TunnelState =
  { status: "starting" } | { status: "ready"; url: string } | { status: "error"; message: string };

/**
 * A Cloudflare quick tunnel to the local server: a free public `https://`
 * address, no account, no router setup. That is what lets players' browsers
 * (on an `https` site) reach a server on the GM's computer. A new address on
 * each start; restarted (with a new address) if cloudflared stops.
 */
export class QuickTunnel {
  private child: ChildProcess | null = null;
  private stopped = false;
  private retries = 0;

  constructor(
    private binary: string,
    private port: number,
    private onState: (state: TunnelState) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.onState({ status: "starting" });
    const child = spawn(
      this.binary,
      ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${this.port}`],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    this.child = child;
    let found = false;
    let log = "";
    const read = (chunk: Buffer) => {
      if (found) return;
      log = (log + chunk.toString()).slice(-4096);
      const url = findTunnelUrl(log);
      if (url) {
        found = true;
        this.retries = 0;
        this.onState({ status: "ready", url });
      }
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (error) => {
      this.onState({ status: "error", message: error.message });
    });
    child.on("exit", (code) => {
      if (this.child === child) this.child = null;
      if (this.stopped) return;
      // A dropped tunnel comes back, a few times, a little later each time.
      this.retries += 1;
      if (this.retries > 5) {
        this.onState({ status: "error", message: `cloudflared exited (${code ?? "signal"})` });
        return;
      }
      this.onState({ status: "starting" });
      setTimeout(() => {
        if (!this.stopped) this.start();
      }, 2000 * this.retries);
    });
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
    this.child = null;
  }
}
