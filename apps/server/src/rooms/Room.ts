import { randomBytes } from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  MAX_BANKED_INPUTS,
  MISS_COOLDOWN_MS,
  PALETTE,
  RECONNECT_GRACE_MS,
  ROUND_END_MS,
  SNAPSHOT_EVERY_TICKS,
  TAG_COOLDOWN_MS,
  TICK_DT,
  clampPitch,
  officeWorld,
  resolveTag,
  seekerRay,
  stepMovement,
  wrapAngle,
  type ClientMessage,
  type ErrorCode,
  type Phase,
  type PlayerInfo,
  type PlayerState,
  type Position,
  type Role,
  type RoomSettings,
  type ServerMessage,
  type Winner,
  type World,
} from '@chameleon/shared';

export interface Peer {
  send(msg: ServerMessage): void;
  isCongested(): boolean;
}

export interface Spawns {
  seeker: Position;
  hiders: Position[];
}

export interface RoomOptions {
  now: () => number;
  maxPlayers: number;
  spawns: Spawns;
  world?: World;
}

type InputMessage = Extract<ClientMessage, { t: 'input' }>;
type RoomMessage = Exclude<ClientMessage, { t: 'create_room' | 'join_room' | 'ping' | 'leave' }>;

const MAX_QUEUED_INPUTS = 20;

export interface Player {
  id: string;
  nickname: string;
  joinOrder: number;
  peer: Peer | null;
  reconnectToken: string;
  disconnectedAt: number;
  ready: boolean;
  role: Role;
  alive: boolean;
  color: number;
  tags: number;
  survived: number;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  inputs: InputMessage[];
  credits: number;
  lastSeq: number;
  tagReadyAt: number;
}

export const token = (bytes = 18) => randomBytes(bytes).toString('base64url');

export class Room {
  readonly players = new Map<string, Player>();
  settings: RoomSettings;
  hostId = '';
  phase: Phase = 'lobby';
  round = 0;
  phaseEndsAt = 0;
  private tick = 0;
  private joinCounter = 0;
  private matchOffset = 0;
  private matchOver = false;
  private stateDirty = false;
  private emptySince: number;
  private readonly world: World;

  constructor(
    readonly code: string,
    private readonly opts: RoomOptions,
  ) {
    this.settings = { ...DEFAULT_SETTINGS, maxPlayers: Math.min(DEFAULT_SETTINGS.maxPlayers, opts.maxPlayers) };
    this.world = opts.world ?? officeWorld;
    this.emptySince = opts.now();
  }

  get connectedCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.peer) n++;
    return n;
  }

  join(peer: Peer, nickname: string): Player | ErrorCode {
    if (this.players.size >= this.settings.maxPlayers) return 'room_full';
    const inMatch = this.phase !== 'lobby';
    const spawn = this.spawnFor(this.joinCounter);
    const player: Player = {
      id: token(6),
      nickname,
      joinOrder: this.joinCounter++,
      peer,
      reconnectToken: token(),
      disconnectedAt: 0,
      ready: false,
      role: inMatch ? 'spectator' : 'hider',
      alive: !inMatch,
      color: this.joinCounter % PALETTE.length,
      tags: 0,
      survived: 0,
      x: spawn.x,
      z: spawn.z,
      yaw: 0,
      pitch: 0,
      inputs: [],
      credits: MAX_BANKED_INPUTS,
      lastSeq: 0,
      tagReadyAt: 0,
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    peer.send({ t: 'welcome', playerId: player.id, code: this.code, reconnectToken: player.reconnectToken });
    this.stateDirty = true;
    return player;
  }

  reconnect(peer: Peer, reconnectToken: string): Player | null {
    for (const p of this.players.values()) {
      if (p.reconnectToken !== reconnectToken) continue;
      p.peer?.send({ t: 'error', code: 'bad_message', message: 'Session resumed elsewhere' });
      p.peer = peer;
      p.disconnectedAt = 0;
      p.inputs = [];
      p.lastSeq = 0;
      peer.send({ t: 'welcome', playerId: p.id, code: this.code, reconnectToken: p.reconnectToken });
      this.stateDirty = true;
      return p;
    }
    return null;
  }

  disconnect(player: Player, peer: Peer): void {
    if (player.peer !== peer) return;
    player.peer = null;
    player.disconnectedAt = this.opts.now();
    player.inputs = [];
    if (this.hostId === player.id) this.reassignHost();
    this.stateDirty = true;
  }

  leave(player: Player): void {
    this.remove(player);
  }

  handle(player: Player, msg: RoomMessage): void {
    switch (msg.t) {
      case 'input':
        if (msg.seq <= player.lastSeq) return;
        player.inputs.push(msg);
        if (player.inputs.length > MAX_QUEUED_INPUTS) player.inputs.shift();
        return;
      case 'ready':
        if (this.phase !== 'lobby') return;
        player.ready = msg.ready;
        this.stateDirty = true;
        return;
      case 'appearance':
        if (this.phase === 'lobby' || (this.phase === 'hide' && player.role === 'hider' && player.alive)) {
          player.color = msg.color;
          this.stateDirty = true;
        }
        return;
      case 'host_settings':
        if (player.id !== this.hostId) return this.error(player, 'not_host', 'Only the host can change settings');
        if (this.phase !== 'lobby') return;
        this.settings = {
          ...msg.settings,
          maxPlayers: Math.max(this.players.size, Math.min(msg.settings.maxPlayers, this.opts.maxPlayers)),
        };
        this.stateDirty = true;
        return;
      case 'start':
        if (player.id !== this.hostId) return this.error(player, 'not_host', 'Only the host can start');
        if (!this.canStart()) return this.error(player, 'cannot_start', 'Need 2+ players and everyone ready');
        this.startMatch();
        return;
      case 'tag':
        this.tag(player, msg.yaw, msg.pitch);
        return;
    }
  }

  canStart(): boolean {
    if (this.phase !== 'lobby') return false;
    const connected = [...this.players.values()].filter((p) => p.peer);
    return connected.length >= 2 && connected.every((p) => p.ready || p.id === this.hostId);
  }

  update(): void {
    const now = this.opts.now();

    for (const p of [...this.players.values()]) {
      if (!p.peer && now - p.disconnectedAt > RECONNECT_GRACE_MS) this.remove(p);
    }

    for (const p of this.players.values()) this.applyInputs(p);

    if (this.phase === 'hide' && now >= this.phaseEndsAt) {
      this.phase = 'seek';
      this.phaseEndsAt = now + this.settings.seekSeconds * 1000;
      this.stateDirty = true;
    } else if (this.phase === 'seek' && now >= this.phaseEndsAt) {
      this.endRound('hiders', 'time');
    } else if (this.phase === 'round_end' && now >= this.phaseEndsAt) {
      if (this.matchOver) this.toLobby();
      else this.startRound();
    }

    if (this.stateDirty) this.broadcastState();
    if (++this.tick % SNAPSHOT_EVERY_TICKS === 0) this.sendSnapshots();

    if (this.connectedCount > 0) this.emptySince = now;
  }

  isExpired(ttlMs: number): boolean {
    return this.players.size === 0 || this.opts.now() - this.emptySince > ttlMs;
  }

  canMove(p: Player): boolean {
    if (!p.alive || p.role === 'spectator') return false;
    if (this.phase === 'lobby') return true;
    if (this.phase === 'hide') return p.role === 'hider';
    return this.phase === 'seek';
  }

  // One input per tick on average; a small bank absorbs network jitter.
  private applyInputs(p: Player): void {
    p.credits = Math.min(MAX_BANKED_INPUTS, p.credits + 1);
    const movable = this.canMove(p);
    while (p.credits > 0 && p.inputs.length) {
      const input = p.inputs.shift()!;
      p.credits--;
      p.lastSeq = input.seq;
      p.yaw = wrapAngle(input.yaw);
      p.pitch = clampPitch(input.pitch);
      if (movable) {
        const next = stepMovement(p, input.buttons, p.yaw, TICK_DT, this.world);
        p.x = next.x;
        p.z = next.z;
      }
    }
  }

  private tag(seeker: Player, yaw: number, pitch: number): void {
    const now = this.opts.now();
    if (this.phase !== 'seek' || seeker.role !== 'seeker' || !seeker.alive || now < seeker.tagReadyAt) return;
    const targets = [...this.players.values()].filter((p) => p.role === 'hider' && p.alive);
    const hitId = resolveTag(this.world, seekerRay(seeker.x, seeker.z, wrapAngle(yaw), clampPitch(pitch)), targets);

    if (!hitId) {
      seeker.tagReadyAt = now + MISS_COOLDOWN_MS;
      seeker.peer?.send({ t: 'tag_result', seekerId: seeker.id, hitId: null, cooldownMs: MISS_COOLDOWN_MS });
      return;
    }
    const hider = this.players.get(hitId)!;
    hider.alive = false;
    hider.inputs = [];
    seeker.tags++;
    seeker.tagReadyAt = now + TAG_COOLDOWN_MS;
    this.broadcast({ t: 'tag_result', seekerId: seeker.id, hitId, cooldownMs: TAG_COOLDOWN_MS });
    this.stateDirty = true;
    if (this.aliveHiders() === 0) this.endRound('seekers', 'all_tagged');
  }

  private startMatch(): void {
    for (const p of this.players.values()) {
      p.tags = 0;
      p.survived = 0;
    }
    this.round = 0;
    this.matchOver = false;
    this.startRound();
  }

  private startRound(): void {
    const now = this.opts.now();
    const order = [...this.players.values()].sort((a, b) => a.joinOrder - b.joinOrder);
    const active = order.filter((p) => p.peer);
    if (active.length < 2) return this.toLobby();

    this.round++;
    const seeker = active[(this.matchOffset + this.round - 1) % active.length]!;
    let spawnIndex = 0;
    for (const p of order) {
      p.inputs = [];
      p.tagReadyAt = 0;
      if (p === seeker) {
        p.role = 'seeker';
        p.alive = true;
        Object.assign(p, this.opts.spawns.seeker);
      } else if (p.peer) {
        p.role = 'hider';
        p.alive = true;
        Object.assign(p, this.spawnFor(spawnIndex++));
      } else {
        p.role = 'spectator';
        p.alive = false;
      }
    }
    this.phase = 'hide';
    this.phaseEndsAt = now + this.settings.hideSeconds * 1000;
    this.stateDirty = true;
  }

  private endRound(winner: Winner, reason: string): void {
    const now = this.opts.now();
    if (winner === 'hiders') {
      for (const p of this.players.values()) if (p.role === 'hider' && p.alive) p.survived++;
    }
    this.matchOver = this.round >= this.settings.rounds;
    this.phase = 'round_end';
    this.phaseEndsAt = now + ROUND_END_MS;
    this.broadcastState();
    this.broadcast({
      t: 'round_end',
      winner,
      reason,
      round: this.round,
      matchOver: this.matchOver,
      nextIn: ROUND_END_MS,
      players: this.playerInfo(),
    });
  }

  private toLobby(): void {
    if (this.round > 0) this.matchOffset++;
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.round = 0;
    this.matchOver = false;
    let i = 0;
    for (const p of this.players.values()) {
      p.ready = false;
      p.role = 'hider';
      p.alive = true;
      Object.assign(p, this.spawnFor(i++));
    }
    this.stateDirty = true;
  }

  private remove(player: Player): void {
    if (!this.players.delete(player.id)) return;
    player.peer = null;
    if (this.hostId === player.id) this.reassignHost();
    this.stateDirty = true;

    if (this.phase !== 'hide' && this.phase !== 'seek') return;
    if (this.connectedCount < 2) this.toLobby();
    else if (player.role === 'seeker') this.endRound('hiders', 'seeker_left');
    else if (this.aliveHiders() === 0) this.endRound('seekers', 'all_tagged');
  }

  private reassignHost(): void {
    const next = [...this.players.values()]
      .filter((p) => p.peer)
      .sort((a, b) => a.joinOrder - b.joinOrder)[0];
    this.hostId = next?.id ?? [...this.players.keys()][0] ?? '';
  }

  private aliveHiders(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.role === 'hider' && p.alive) n++;
    return n;
  }

  private spawnFor(i: number): Position {
    const list = this.opts.spawns.hiders;
    return { ...list[i % list.length]! };
  }

  private playerInfo(): PlayerInfo[] {
    return [...this.players.values()]
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        ready: p.ready,
        role: p.role,
        alive: p.alive,
        connected: p.peer !== null,
        color: p.color,
        tags: p.tags,
        survived: p.survived,
      }));
  }

  private broadcastState(): void {
    this.stateDirty = false;
    this.broadcast({
      t: 'room_state',
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      settings: this.settings,
      players: this.playerInfo(),
    });
  }

  private sendSnapshots(): void {
    const now = this.opts.now();
    const visible = [...this.players.values()].filter((p) => p.alive && p.role !== 'spectator');
    const state = (p: Player): PlayerState => ({
      id: p.id,
      x: round3(p.x),
      z: round3(p.z),
      yaw: round3(p.yaw),
      pitch: round3(p.pitch),
    });
    const all = visible.map(state);
    // Seekers get no hider positions while they're blindfolded.
    const seekerView = visible.filter((p) => p.role !== 'hider').map(state);
    const phaseEndsIn = this.phase === 'lobby' ? 0 : Math.max(0, this.phaseEndsAt - now);

    for (const p of this.players.values()) {
      if (!p.peer || p.peer.isCongested()) continue;
      p.peer.send({
        t: 'snapshot',
        tick: this.tick,
        phase: this.phase,
        phaseEndsIn,
        ack: p.lastSeq,
        players: this.phase === 'hide' && p.role === 'seeker' ? seekerView : all,
      });
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const p of this.players.values()) p.peer?.send(msg);
  }

  private error(player: Player, code: ErrorCode, message: string): void {
    player.peer?.send({ t: 'error', code, message });
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
