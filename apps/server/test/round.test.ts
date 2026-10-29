import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  BUILD_ID,
  SEEKER_SPAWN,
  officeWorld,
  raycastWorld,
  seekerRay,
  type ClientMessage,
  type ServerMessage,
} from '@chameleon/shared';
import { loadConfig } from '../src/config';
import { startServer, type GameServer } from '../src/server';

const ORIGIN = 'http://test.local';
// Straight up the east aisle from the seeker spawn, inside tag range.
const HIDER = { x: SEEKER_SPAWN.x, z: SEEKER_SPAWN.z - 3 };

let offset = 0;
let server: GameServer;
let url: string;

class Client {
  readonly ws: WebSocket;
  readonly inbox: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  constructor(origin = ORIGIN) {
    this.ws = new WebSocket(url, { origin });
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      this.inbox.push(msg);
      this.waiters = this.waiters.filter((w) => (w.pred(msg) ? (w.resolve(msg), false) : true));
    });
  }

  open() {
    return new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor<T extends ServerMessage['t']>(t: T, pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
    type M = Extract<ServerMessage, { t: T }>;
    const match = (m: ServerMessage): m is M => m.t === t && pred(m as M);
    const found = this.inbox.find(match);
    if (found) return Promise.resolve(found as M);
    return new Promise<M>((resolve) => this.waiters.push({ pred: match, resolve: resolve as (m: ServerMessage) => void }));
  }

  close() {
    this.ws.close();
  }
}

beforeAll(async () => {
  const config = { ...loadConfig({}), port: 0, allowedOrigins: [ORIGIN] };
  server = await startServer({
    config,
    now: () => Date.now() + offset,
    spawns: { seeker: SEEKER_SPAWN, hiders: [HIDER] },
  });
  url = `ws://127.0.0.1:${server.port}/ws`;
});

afterAll(() => server.close());

describe('multiplayer round over websockets', () => {
  it('has clear line of sight between the test spawns', () => {
    const dz = HIDER.z - SEEKER_SPAWN.z;
    const ray = seekerRay(SEEKER_SPAWN.x, SEEKER_SPAWN.z, 0, Math.atan2(0.6 - 1.6, Math.abs(dz)));
    expect(raycastWorld(officeWorld, ray, 3.5)).toBe(3.5);
  });

  it('plays create → join → hide → seek → tag → round end', async () => {
    const host = new Client();
    const guest = new Client();
    await Promise.all([host.open(), guest.open()]);

    host.send({ t: 'create_room', nickname: 'Host', build: BUILD_ID });
    const hostWelcome = await host.waitFor('welcome');

    guest.send({ t: 'join_room', code: hostWelcome.code, nickname: 'Guest', build: BUILD_ID });
    const guestWelcome = await guest.waitFor('welcome');
    await host.waitFor('room_state', (m) => m.players.length === 2);

    guest.send({ t: 'ready', ready: true });
    await host.waitFor('room_state', (m) => m.players.every((p) => p.ready || p.id === m.hostId));
    host.send({ t: 'start' });
    const hide = await guest.waitFor('room_state', (m) => m.phase === 'hide');
    expect(hide.players.find((p) => p.id === hostWelcome.playerId)?.role).toBe('seeker');

    // Guest moves during hide; the server acknowledges and applies it.
    guest.send({ t: 'input', seq: 1, buttons: 0, yaw: 0, pitch: 0 });
    await guest.waitFor('snapshot', (m) => m.ack === 1);

    // Seeker snapshots exclude the hider while blindfolded.
    const blind = await host.waitFor('snapshot', (m) => m.phase === 'hide');
    expect(blind.players.map((p) => p.id)).toEqual([hostWelcome.playerId]);

    offset += 31_000;
    await host.waitFor('snapshot', (m) => m.phase === 'seek');

    host.send({ t: 'tag', yaw: 0, pitch: Math.atan2(0.6 - 1.6, 3) });
    const result = await guest.waitFor('tag_result');
    expect(result.hitId).toBe(guestWelcome.playerId);

    const end = await guest.waitFor('round_end');
    expect(end.winner).toBe('seekers');
    expect(end.players.find((p) => p.id === hostWelcome.playerId)?.tags).toBe(1);

    host.close();
    guest.close();
  });

  it('resumes identity with the reconnect token', async () => {
    const a = new Client();
    await a.open();
    a.send({ t: 'create_room', nickname: 'A', build: BUILD_ID });
    const first = await a.waitFor('welcome');
    a.close();

    const b = new Client();
    await b.open();
    b.send({ t: 'join_room', code: first.code, nickname: 'A', build: BUILD_ID, reconnectToken: first.reconnectToken });
    const second = await b.waitFor('welcome');
    expect(second.playerId).toBe(first.playerId);
    b.close();
  });

  it('rejects unknown origins and stale builds', async () => {
    const evil = new Client('http://evil.example');
    await expect(evil.open()).rejects.toThrow(/403/);

    const old = new Client();
    await old.open();
    old.send({ t: 'create_room', nickname: 'Old', build: 'p0-stale' });
    expect((await old.waitFor('error')).code).toBe('incompatible_build');
    old.close();
  });

  it('serves a health check', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/health`);
    expect(await res.json()).toMatchObject({ ok: true, build: BUILD_ID });
  });
});
