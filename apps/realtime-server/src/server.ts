/**
 * Adventure Keeper's self-hosted realtime server. One room per live session,
 * in memory, relayed over WebSocket; saved to disk so a restart loses nothing.
 * See docs/REALTIME_SERVER.md for installing it.
 *
 * Environment:
 * - `PORT` (8787) — where it listens (behind a TLS reverse proxy in production);
 * - `FIREBASE_PROJECT_ID` — the app's Firebase project: only its users get in;
 * - `DATA_DIR` (`./data`) — where the rooms are saved;
 * - `ALLOWED_ORIGINS` — comma-separated origins of the app (`https://…`), or `*`;
 * - `FIREBASE_AUTH_EMULATOR=1` — accept the Auth emulator's unsigned tokens
 *   (development and tests only);
 * - `HOST` — the interface to listen on (all of them by default);
 * - `CLOUDFLARED_PATH` — open a Cloudflare quick tunnel with this cloudflared
 *   binary: the public `https://` address players use (the desktop app);
 * - `STATUS_JSON=1` — report the server's state on stdout, one
 *   `AK_STATUS {json}` line per change, and stop when stdin says `quit` or
 *   closes (the desktop app, which runs this server as its child).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  clientMessageSchema,
  type RealtimeHealth,
  type ServerMessage,
} from "@adventure-keeper/schemas";

import { verifyFirebaseToken, type AuthOptions } from "./auth";
import { Room, type Actor } from "./room";
import { RoomStore } from "./store";
import { QuickTunnel, type TunnelState } from "./tunnel";

const VERSION = "0.2.0";
const PORT = Number(process.env.PORT ?? 8787);
const auth: AuthOptions = {
  projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  emulator: process.env.FIREBASE_AUTH_EMULATOR === "1",
};
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const store = new RoomStore(process.env.DATA_DIR ?? "./data");
const HOST = process.env.HOST || undefined;
const STATUS_JSON = process.env.STATUS_JSON === "1";
const CLOUDFLARED_PATH = process.env.CLOUDFLARED_PATH || undefined;

const originAllowed = (origin: string | undefined) =>
  ALLOWED_ORIGINS.includes("*") || (origin !== undefined && ALLOWED_ORIGINS.includes(origin));

// --- HTTP: health check (the app's « Tester » button) -------------------------

function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    // The site (public) asking a server on this computer (private network):
    // Chrome wants this answer before it lets the request through.
    if (req.headers["access-control-request-private-network"] === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    res.writeHead(204).end();
    return;
  }
  if (req.url === "/health" || req.url === "/") {
    const body: RealtimeHealth = {
      ok: true,
      service: "adventure-keeper-realtime",
      version: VERSION,
      ...(tunnel.status === "ready" ? { publicUrl: tunnel.url } : {}),
    };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    return;
  }
  res.writeHead(404).end();
}

// --- Status (the desktop app's window) -----------------------------------------

let tunnel: TunnelState | { status: "off" } = { status: "off" };
let listening: { status: "starting" } | { status: "ready" } | { status: "error"; message: string } =
  { status: "starting" };

/** One `AK_STATUS {json}` line on stdout: the desktop app shows it. */
function reportStatus() {
  if (!STATUS_JSON) return;
  let players = 0;
  for (const peers of sockets.values()) players += peers.size;
  const status = {
    version: VERSION,
    port: PORT,
    server: listening,
    tunnel,
    rooms: sockets.size,
    players,
  };
  process.stdout.write(`AK_STATUS ${JSON.stringify(status)}\n`);
}

// --- Rooms ---------------------------------------------------------------------

const rooms = new Map<string, Room>();
const sockets = new Map<string, Set<WebSocket>>();
const actors = new WeakMap<WebSocket, Actor & { room: string }>();

async function openRoom(id: string, memberKey: string, gmKey: string | undefined) {
  // Room ids are session ids: letters, digits, dashes.
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  let room = rooms.get(id);
  if (!room) {
    const record = await store.load(id);
    if (record) room = new Room(record);
    else if (gmKey) {
      // A new room: only the GM, who holds both keys, opens it.
      room = Room.create(id, memberKey, gmKey);
      store.save(room.record);
    } else return null;
    rooms.set(id, room);
  }
  const admitted = room.admit(memberKey, gmKey);
  return admitted ? { room, gm: admitted.gm } : null;
}

const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
};

function broadcast(roomId: string, message: ServerMessage) {
  for (const socket of sockets.get(roomId) ?? []) send(socket, message);
}

function presence(roomId: string): string[] {
  const uids = new Set<string>();
  for (const socket of sockets.get(roomId) ?? []) {
    const actor = actors.get(socket);
    if (actor) uids.add(actor.uid);
  }
  return [...uids];
}

function onConnection(socket: WebSocket) {
  // A tab must say hello within a few seconds, or it is let go.
  const helloTimer = setTimeout(() => socket.close(4001, "hello expected"), 10_000);
  socket.on("message", async (raw) => {
    let parsed;
    try {
      parsed = clientMessageSchema.safeParse(JSON.parse(String(raw)));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) {
      send(socket, { type: "error", message: "bad message" });
      return;
    }
    const message = parsed.data;
    const actor = actors.get(socket);

    if (message.type === "ping") {
      send(socket, { type: "pong" });
      return;
    }

    if (message.type === "hello") {
      if (actor) return;
      try {
        const uid = await verifyFirebaseToken(message.token, auth);
        const opened = await openRoom(message.room, message.memberKey, message.gmKey);
        if (!opened) {
          socket.close(4003, "bad key");
          return;
        }
        clearTimeout(helloTimer);
        actors.set(socket, { uid, gm: opened.gm, room: message.room });
        const peers = sockets.get(message.room) ?? new Set<WebSocket>();
        peers.add(socket);
        sockets.set(message.room, peers);
        send(socket, {
          type: "welcome",
          uid,
          gm: opened.gm,
          empty: opened.room.empty,
          state: opened.room.state,
          uids: presence(message.room),
        });
        broadcast(message.room, { type: "presence", uids: presence(message.room) });
        reportStatus();
      } catch (error) {
        console.warn("hello refused:", (error as Error).message);
        socket.close(4003, "unauthorized");
      }
      return;
    }

    if (!actor) {
      send(socket, { type: "error", message: "hello first" });
      return;
    }
    const room = rooms.get(actor.room);
    if (!room) return;
    const result = room.apply(actor, message.op);
    if ("error" in result) {
      send(socket, { type: "error", message: result.error, ref: message.ref });
      return;
    }
    store.save(room.record);
    for (const event of result) broadcast(actor.room, event);
  });

  socket.on("close", () => {
    clearTimeout(helloTimer);
    const actor = actors.get(socket);
    if (!actor) return;
    const peers = sockets.get(actor.room);
    peers?.delete(socket);
    if (peers && peers.size === 0) {
      sockets.delete(actor.room);
      // Nobody left: the room leaves memory (it is on disk).
      rooms.delete(actor.room);
    } else broadcast(actor.room, { type: "presence", uids: presence(actor.room) });
    reportStatus();
  });
}

// --- Start -----------------------------------------------------------------------

const server = createServer(handleHttp);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  verifyClient: ({ origin }: { origin: string }) => originAllowed(origin),
});
wss.on("connection", onConnection);

// A dead connection (sleeping laptop) is noticed within a minute.
const alive = new WeakSet<WebSocket>();
wss.on("connection", (socket) => {
  alive.add(socket);
  socket.on("pong", () => alive.add(socket));
});
setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) socket.terminate();
    else {
      alive.delete(socket);
      socket.ping();
    }
  }
}, 30_000);

// Rooms untouched for 60 days are forgotten, once a day.
setInterval(() => void store.prune(60), 86_400_000);

const quickTunnel = CLOUDFLARED_PATH
  ? new QuickTunnel(CLOUDFLARED_PATH, PORT, (state) => {
      tunnel = state;
      if (state.status === "ready") process.stderr.write(`Public address: ${state.url}\n`);
      if (state.status === "error") console.warn("tunnel:", state.message);
      reportStatus();
    })
  : null;

server.on("error", (error: NodeJS.ErrnoException) => {
  listening = {
    status: "error",
    message: error.code === "EADDRINUSE" ? `port ${PORT} in use` : error.message,
  };
  console.error("server:", listening.message);
  reportStatus();
  if (!STATUS_JSON) process.exit(1);
});

server.listen(PORT, HOST, () => {
  listening = { status: "ready" };
  reportStatus();
  quickTunnel?.start();
  process.stdout.write(
    `Adventure Keeper realtime ${VERSION} on :${PORT}` +
      (auth.emulator
        ? " (Auth emulator tokens accepted)\n"
        : ` (project ${auth.projectId ?? "?"})\n`),
  );
  if (!auth.emulator && !auth.projectId) {
    console.warn("FIREBASE_PROJECT_ID is not set: nobody can join.");
  }
});

async function shutdown() {
  quickTunnel?.stop();
  await store.flush();
  process.exit(0);
}
// Whatever the way out, cloudflared is not left behind.
process.on("exit", () => quickTunnel?.stop());

if (STATUS_JSON) {
  // The desktop app says `quit` (or goes away) when its window closes.
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    if (chunk.split(/\r?\n/).includes("quit")) void shutdown();
  });
  process.stdin.on("end", () => void shutdown());
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
