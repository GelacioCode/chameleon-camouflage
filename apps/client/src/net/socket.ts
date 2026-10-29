import type { ClientMessage, ServerMessage } from '@chameleon/shared';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

const PING_MS = 2000;
const MAX_BACKOFF_MS = 8000;

export function defaultSocketUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class NetClient {
  status: ConnectionStatus = 'idle';
  rtt: number | null = null;
  private ws: WebSocket | null = null;
  private manualClose = false;
  private attempts = 0;
  private pingId = 0;
  private pingSent = new Map<number, number>();
  private pingTimer = 0;
  private retryTimer = 0;
  private readonly messageListeners = new Set<(msg: ServerMessage) => void>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();

  /** Called on every (re)open; used to rejoin the room. */
  onOpen: (() => void) | null = null;

  constructor(private readonly url = defaultSocketUrl()) {}

  connect(): void {
    this.manualClose = false;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.setStatus(this.attempts ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.setStatus('open');
      this.onOpen?.();
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), PING_MS);
    };
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        const sent = this.pingSent.get(msg.id);
        if (sent !== undefined) this.rtt = performance.now() - sent;
        this.pingSent.delete(msg.id);
        return;
      }
      for (const fn of this.messageListeners) fn(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.manualClose) return this.setStatus('closed');
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts++) * (0.75 + Math.random() * 0.5);
      this.setStatus('reconnecting');
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.manualClose = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    this.attempts = 0;
    this.setStatus('closed');
  }

  onMessage(fn: (msg: ServerMessage) => void): () => void {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  onStatus(fn: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private ping(): void {
    const id = ++this.pingId;
    this.pingSent.set(id, performance.now());
    if (this.pingSent.size > 10) this.pingSent.delete(this.pingSent.keys().next().value!);
    this.send({ t: 'ping', id });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const fn of this.statusListeners) fn(status);
  }
}
