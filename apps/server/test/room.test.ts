import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUTTON,
  DEFAULT_SETTINGS,
  RECONNECT_GRACE_MS,
  ROUND_END_MS,
  buildWorld,
  type ServerMessage,
} from '@chameleon/shared';
import { Room, type Peer, type Player } from '../src/rooms/Room';

class FakePeer implements Peer {
  messages: ServerMessage[] = [];
  send(msg: ServerMessage) {
    this.messages.push(msg);
  }
  isCongested() {
    return false;
  }
  last<T extends ServerMessage['t']>(t: T) {
    return this.messages.filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t).at(-1);
  }
}

// Open floor: seeker at the origin, hiders three metres north.
const world = buildWorld([]);
world.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
const spawns = {
  seeker: { x: 0, z: 0 },
  hiders: [
    { x: 0, z: -3 },
    { x: 2, z: -3 },
  ],
};

let time = 0;
let room: Room;
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 50) {
    time += 50;
    room.update();
  }
};
const aimAt = (from: Player, to: Player) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(0.6 - 1.6, Math.hypot(dx, dz)) };
};

function setup(count = 2) {
  const peers = Array.from({ length: count }, () => new FakePeer());
  const players = peers.map((peer, i) => room.join(peer, `p${i}`) as Player);
  for (const p of players.slice(1)) room.handle(p, { t: 'ready', ready: true });
  return { peers, players };
}

beforeEach(() => {
  time = 0;
  room = new Room('ABCDE', { now: () => time, maxPlayers: 8, spawns, world });
});

describe('Room', () => {
  it('needs two ready players before the host can start', () => {
    const host = new FakePeer();
    const p0 = room.join(host, 'host') as Player;
    room.handle(p0, { t: 'start' });
    expect(room.phase).toBe('lobby');
    expect(host.last('error')?.code).toBe('cannot_start');

    const other = room.join(new FakePeer(), 'guest') as Player;
    room.handle(p0, { t: 'start' });
    expect(room.phase).toBe('lobby');
    room.handle(other, { t: 'ready', ready: true });
    room.handle(other, { t: 'start' });
    expect(room.phase).toBe('lobby');
    room.handle(p0, { t: 'start' });
    expect(room.phase).toBe('hide');
  });

  it('runs hide → seek → tag → round end → next round with rotated seeker', () => {
    const { players } = setup();
    const [a, b] = players as [Player, Player];
    room.handle(a, { t: 'start' });
    expect(a.role).toBe('seeker');
    expect(b.role).toBe('hider');

    // Seeker is frozen and can't tag during hide.
    room.handle(a, { t: 'input', seq: 1, buttons: BUTTON.forward, yaw: 0, pitch: 0 });
    room.handle(a, { t: 'tag', ...aimAt(a, b) });
    advance(100);
    expect(a.z).toBe(0);
    expect(b.alive).toBe(true);

    advance(DEFAULT_SETTINGS.hideSeconds * 1000);
    expect(room.phase).toBe('seek');

    room.handle(a, { t: 'tag', ...aimAt(a, b) });
    expect(b.alive).toBe(false);
    expect(a.tags).toBe(1);
    expect(room.phase).toBe('round_end');

    advance(ROUND_END_MS + 50);
    expect(room.phase).toBe('hide');
    expect(room.round).toBe(2);
    expect(b.role).toBe('seeker');
    expect(a.role).toBe('hider');
  });

  it('hides hider positions from the seeker during hide', () => {
    const { peers, players } = setup();
    room.handle(players[0]!, { t: 'start' });
    advance(100);
    expect(peers[0]!.last('snapshot')!.players.map((p) => p.id)).toEqual([players[0]!.id]);
    expect(peers[1]!.last('snapshot')!.players).toHaveLength(2);
  });

  it('applies a miss cooldown', () => {
    const { players } = setup();
    const [a, b] = players as [Player, Player];
    room.handle(a, { t: 'start' });
    advance(DEFAULT_SETTINGS.hideSeconds * 1000);
    room.handle(a, { t: 'tag', yaw: Math.PI, pitch: 0 });
    room.handle(a, { t: 'tag', ...aimAt(a, b) });
    expect(b.alive).toBe(true);
    advance(2100);
    room.handle(a, { t: 'tag', ...aimAt(a, b) });
    expect(b.alive).toBe(false);
  });

  it('awards hiders when time runs out and returns to lobby after the last round', () => {
    const { players } = setup();
    room.settings = { ...room.settings, rounds: 1 };
    room.handle(players[0]!, { t: 'start' });
    advance((DEFAULT_SETTINGS.hideSeconds + DEFAULT_SETTINGS.seekSeconds) * 1000 + 50);
    expect(room.phase).toBe('round_end');
    expect(players[1]!.survived).toBe(1);
    advance(ROUND_END_MS + 50);
    expect(room.phase).toBe('lobby');
    expect(players.every((p) => !p.ready)).toBe(true);
  });

  it('limits movement to one input per tick on average', () => {
    const { players } = setup();
    const p = players[1]!;
    for (let seq = 1; seq <= 20; seq++) room.handle(p, { t: 'input', seq, buttons: BUTTON.forward, yaw: 0, pitch: 0 });
    const z0 = p.z;
    advance(50);
    // Bank of 4 plus 1 refill, capped at the bank size.
    expect(z0 - p.z).toBeCloseTo(0.1 * 4, 5);
  });

  it('resumes a disconnected player and gives hiders the round if the seeker leaves', () => {
    const { players } = setup(3);
    const [a] = players as [Player, Player, Player];
    room.handle(a, { t: 'start' });
    const oldPeer = a.peer!;
    room.disconnect(a, oldPeer);
    expect(room.hostId).not.toBe(a.id);

    const fresh = new FakePeer();
    expect(room.reconnect(fresh, a.reconnectToken)).toBe(a);
    expect(fresh.last('welcome')?.playerId).toBe(a.id);
    expect(room.players.size).toBe(3);

    room.disconnect(a, fresh);
    advance(RECONNECT_GRACE_MS + 100);
    expect(room.players.has(a.id)).toBe(false);
    expect(room.phase).toBe('round_end');
  });

  it('drops back to lobby when fewer than two players remain', () => {
    const { players } = setup();
    room.handle(players[0]!, { t: 'start' });
    room.leave(players[1]!);
    expect(room.phase).toBe('lobby');
  });
});
