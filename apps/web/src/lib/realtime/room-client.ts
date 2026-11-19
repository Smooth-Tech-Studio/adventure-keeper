import type {
  ClientMessage,
  RealtimeHealth,
  RoomOp,
  RoomState,
  ServerMessage,
} from "@adventure-keeper/schemas";

export type RoomStatus = "connecting" | "open" | "closed";

export interface RoomSnapshot {
  status: RoomStatus;
  state: RoomState;
  /** The server knows us: who, and whether as the GM. */
  uid: string | null;
  gm: boolean;
  /** uids with a tab in the room. */
  uids: string[];
}

interface RoomClientOptions {
  url: string;
  room: string;
  memberKey: string;
  gmKey?: string;
  /** A fresh Firebase ID token for each (re)connection. */
  getToken: () => Promise<string>;
  /** A change the server refused. */
  onError?: (message: string) => void;
}

/** `https://jeu.example.org` → `wss://jeu.example.org/ws`. */
export function socketUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/ws`;
  return parsed.toString();
}

/** Whether a server answers at `url` (the launch dialog's « Tester »). */
export async function checkRealtimeServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json()) as Partial<RealtimeHealth>;
    return response.ok && body.service === "adventure-keeper-realtime";
  } catch {
    return false;
  }
}

/** Where Adventure Keeper Serveur (the desktop app) listens, on the GM's computer. */
export const LOCAL_SERVER = "http://127.0.0.1:8787";

/**
 * Whether this site may already ask `127.0.0.1` without the browser asking
 * the user (Chrome's « local network access » permission, once granted).
 * False when unknown: other browsers do not have it.
 */
export async function localServerAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({
      name: "local-network-access" as PermissionName,
    });
    return status.state === "granted";
  } catch {
    return false;
  }
}

/**
 * The public address of Adventure Keeper Serveur running on this computer,
 * or null when it is not running (or its tunnel is not open yet). Browsers
 * let an https page ask `127.0.0.1`, but Chrome asks the user first: call it
 * on a click, or when `localServerAllowed()`.
 */
export async function findLocalServer(): Promise<string | null> {
  try {
    const response = await fetch(`${LOCAL_SERVER}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = (await response.json()) as Partial<RealtimeHealth>;
    if (!response.ok || body.service !== "adventure-keeper-realtime") return null;
    return body.publicUrl?.startsWith("https://") ? body.publicUrl : null;
  } catch {
    return null;
  }
}

/**
 * A live session's room on the self-hosted server: holds its state as the
 * server last said it, sends changes, and reconnects on its own (a laptop
 * asleep, a network hiccup) — each time with a full state back.
 */
export class RoomClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<(snapshot: RoomSnapshot) => void>();
  private queue: ClientMessage[] = [];
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  snapshot: RoomSnapshot = {
    status: "connecting",
    state: { combatants: {}, combat: null, fog: {} },
    uid: null,
    gm: false,
    uids: [],
  };

  constructor(private options: RoomClientOptions) {
    void this.connect();
  }

  subscribe(listener: (snapshot: RoomSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Send a change; held until the room has welcomed us. */
  send(op: RoomOp): void {
    const message: ClientMessage = { type: "op", op };
    if (this.snapshot.status === "open" && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else this.queue.push(message);
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.socket?.close();
    this.update({ status: "closed" });
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private async connect() {
    if (this.closed) return;
    this.update({ status: "connecting" });
    let token: string;
    try {
      token = await this.options.getToken();
    } catch {
      this.scheduleRetry();
      return;
    }
    const socket = new WebSocket(socketUrl(this.options.url));
    this.socket = socket;
    socket.onopen = () => {
      const hello: ClientMessage = {
        type: "hello",
        room: this.options.room,
        memberKey: this.options.memberKey,
        ...(this.options.gmKey ? { gmKey: this.options.gmKey } : {}),
        token,
      };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = (event) => this.receive(JSON.parse(String(event.data)) as ServerMessage);
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      // A player may arrive before the GM has opened the room: try again.
      this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (this.closed) return;
    this.update({ status: "connecting" });
    const delay = Math.min(10_000, 500 * 2 ** this.retry);
    this.retry += 1;
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private receive(message: ServerMessage) {
    const state = this.snapshot.state;
    switch (message.type) {
      case "welcome": {
        this.retry = 0;
        this.update({
          status: "open",
          uid: message.uid,
          gm: message.gm,
          uids: message.uids,
          state: withFog(message.state),
        });
        const pending = this.queue;
        this.queue = [];
        for (const queued of pending) this.socket?.send(JSON.stringify(queued));
        return;
      }
      case "combatant":
        this.update({
          state: {
            ...state,
            combatants: { ...state.combatants, [message.combatant.id]: message.combatant },
          },
        });
        return;
      case "combatant.removed": {
        const combatants = { ...state.combatants };
        delete combatants[message.id];
        this.update({ state: { ...state, combatants } });
        return;
      }
      case "combat":
        this.update({ state: { ...state, combat: message.combat } });
        return;
      case "participant":
        this.update({
          state: {
            ...state,
            participants: { ...state.participants, [message.characterId]: message.participant },
          },
        });
        return;
      case "fog":
        this.update({
          state: { ...state, fog: { ...state.fog, [message.locationId]: message.fog } },
        });
        return;
      case "state":
        this.update({ state: withFog(message.state) });
        return;
      case "presence":
        this.update({ uids: message.uids });
        return;
      case "error":
        this.options.onError?.(message.message);
        return;
      case "pong":
        return;
    }
  }
}

/**
 * A server older than the fog sends none. One older than the participants
 * sends none either, and that stays visible (`participants` absent): they
 * are then written to Firestore, as without a server.
 */
const withFog = (state: RoomState): RoomState => ({ ...state, fog: state.fog ?? {} });
