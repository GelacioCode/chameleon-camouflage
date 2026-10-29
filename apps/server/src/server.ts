import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { BUILD_ID, HIDER_SPAWNS, MAX_MESSAGE_BYTES, SEEKER_SPAWN, TICK_MS } from '@chameleon/shared';
import type { Config } from './config';
import { handleConnection } from './net/connection';
import type { Spawns } from './rooms/Room';
import { RoomManager } from './rooms/RoomManager';

export interface ServerOptions {
  config: Config;
  now?: () => number;
  spawns?: Spawns;
}

export interface GameServer {
  port: number;
  manager: RoomManager;
  close(): Promise<void>;
}

const HEARTBEAT_MS = 20_000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export async function startServer({ config, now = Date.now, spawns }: ServerOptions): Promise<GameServer> {
  const started = now();
  const manager = new RoomManager({
    now,
    maxPlayers: config.maxRoomPlayers,
    spawns: spawns ?? { seeker: SEEKER_SPAWN, hiders: HIDER_SPAWNS },
  });

  const server = http.createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, build: BUILD_ID, uptime: Math.round((now() - started) / 1000), ...manager.stats() }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"ok":false}');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const perIp = new Map<string, number>();
  const alive = new WeakMap<WebSocket, boolean>();

  const clientIp = (req: http.IncomingMessage) => {
    const remote = req.socket.remoteAddress ?? '';
    const forwarded = req.headers['x-forwarded-for'];
    if (config.trustProxy && LOOPBACK.has(remote) && typeof forwarded === 'string') {
      return forwarded.split(',')[0]!.trim();
    }
    return remote;
  };

  server.on('upgrade', (req, socket, head) => {
    const reject = (status: string) => {
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    };
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== '/ws') return reject('404 Not Found');

    // HTTP CORS doesn't cover WebSockets; check Origin explicitly.
    const origin = req.headers.origin;
    if (origin ? !config.allowedOrigins.includes(origin) : config.production) return reject('403 Forbidden');

    const ip = clientIp(req);
    const count = perIp.get(ip) ?? 0;
    if (count >= config.maxConnectionsPerIp) return reject('429 Too Many Requests');

    wss.handleUpgrade(req, socket, head, (ws) => {
      perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
      alive.set(ws, true);
      ws.on('pong', () => alive.set(ws, true));
      ws.on('close', () => {
        const n = (perIp.get(ip) ?? 1) - 1;
        if (n > 0) perIp.set(ip, n);
        else perIp.delete(ip);
      });
      handleConnection(ws, manager, now);
    });
  });

  const tick = setInterval(() => manager.update(), TICK_MS);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);

  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));

  return {
    port: (server.address() as AddressInfo).port,
    manager,
    async close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
