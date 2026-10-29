import {
  HIDER_EYE,
  SEEKER_EYE,
  SEEKER_SPAWN,
  TICK_DT,
  TICK_MS,
  directionFromAngles,
  moveDelta,
  officeWorld,
  raycastWorld,
  stepMovement,
  type Phase,
  type PlayerInfo,
  type Position,
  type ServerMessage,
} from '@chameleon/shared';
import { getState, net, send } from '../session';
import { Avatar } from './avatars';
import { Controls } from './controls';
import { SnapshotBuffer } from './interpolation';
import { createWorld, type World } from './world';

type Snapshot = Extract<ServerMessage, { t: 'snapshot' }>;
type CameraMode = 'first' | 'third' | 'free';

const THIRD_PERSON_DISTANCE = 2.4;
const SNAP_DISTANCE = 2;
const FREE_CAM_HEIGHT = 2.2;
const FREE_CAM_SPEED = 1.6;
const MAX_FRAME_MS = 250;

export class Game {
  private controls: Controls;
  private self: Position = { ...SEEKER_SPAWN };
  private prevSelf: Position = { ...SEEKER_SPAWN };
  private correction = { x: 0, z: 0 };
  private pending: { seq: number; buttons: number; yaw: number }[] = [];
  private seq = 0;
  private phase: Phase = 'lobby';
  private spawned = false;
  private readonly snapshots = new SnapshotBuffer();
  private readonly remotes = new Map<string, Avatar>();
  private readonly selfAvatar = new Avatar();
  private freeCam: { x: number; z: number } | null = null;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private readonly cleanup: (() => void)[] = [];

  private constructor(
    private readonly world: World,
    private readonly mode: 'solo' | 'online',
  ) {
    const canvas = world.renderer.domElement;
    this.controls = new Controls(canvas);
    this.controls.yaw = 0.6;
    world.scene.add(this.selfAvatar.group);

    if (mode === 'online') {
      this.controls.onFire = () => this.fire();
      this.controls.onColorKey = (color) => this.pickColor(color);
      this.cleanup.push(net.onMessage((msg) => msg.t === 'snapshot' && this.onSnapshot(msg)));
    }
    const onResize = () => world.resize();
    addEventListener('resize', onResize);
    this.cleanup.push(() => removeEventListener('resize', onResize));
    this.raf = requestAnimationFrame(this.frame);
  }

  static async create(container: HTMLElement, mode: 'solo' | 'online'): Promise<Game> {
    return new Game(await createWorld(container), mode);
  }

  pickColor(color: number): void {
    const me = this.me();
    if (this.phase === 'lobby' || (this.phase === 'hide' && me?.role === 'hider' && me.alive)) {
      send({ t: 'appearance', color });
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn();
    this.controls.dispose();
    for (const avatar of this.remotes.values()) avatar.dispose();
    this.selfAvatar.dispose();
    this.world.dispose();
  }

  private me(): PlayerInfo | undefined {
    const { room, playerId } = getState();
    return room?.players.find((p) => p.id === playerId);
  }

  // Mirrors Room.canMove on the server.
  private canMove(): boolean {
    if (this.mode === 'solo') return true;
    const me = this.me();
    if (!me || !me.alive || me.role === 'spectator') return false;
    if (this.phase === 'lobby') return true;
    if (this.phase === 'hide') return me.role === 'hider';
    return this.phase === 'seek';
  }

  private cameraMode(): CameraMode {
    if (this.mode === 'solo') return 'first';
    const me = this.me();
    if (!me || !me.alive || me.role === 'spectator') return 'free';
    return me.role === 'seeker' ? 'first' : 'third';
  }

  private fire(): void {
    const me = this.me();
    if (this.phase !== 'seek' || me?.role !== 'seeker' || performance.now() < getState().tagReadyAt) return;
    send({ t: 'tag', yaw: this.controls.yaw, pitch: this.controls.pitch });
  }

  private step(): void {
    const buttons = this.controls.buttons();
    const { yaw, pitch } = this.controls;
    this.prevSelf = { ...this.self };

    if (this.cameraMode() === 'free') return;

    if (this.mode === 'online') {
      if (!this.spawned || net.status !== 'open') return;
      const seq = ++this.seq;
      send({ t: 'input', seq, buttons, yaw, pitch });
      this.pending.push({ seq, buttons, yaw });
      if (this.pending.length > 120) this.pending.shift();
    }
    if (this.canMove()) this.self = stepMovement(this.self, buttons, yaw, TICK_DT, officeWorld);
  }

  private onSnapshot(msg: Snapshot): void {
    const myId = getState().playerId;
    this.phase = msg.phase;
    this.snapshots.push(
      performance.now(),
      msg.players.filter((p) => p.id !== myId),
    );
    const mine = msg.players.find((p) => p.id === myId);
    if (!mine) return;

    // Reconcile: start from the server position and replay unacknowledged inputs.
    this.pending = this.pending.filter((i) => i.seq > msg.ack);
    let pos: Position = { x: mine.x, z: mine.z };
    if (this.canMove()) {
      for (const input of this.pending) pos = stepMovement(pos, input.buttons, input.yaw, TICK_DT, officeWorld);
    }
    const dx = this.self.x - pos.x;
    const dz = this.self.z - pos.z;
    if (!this.spawned || Math.hypot(dx, dz) > SNAP_DISTANCE) {
      this.correction = { x: 0, z: 0 };
      this.prevSelf = { ...pos };
      if (!this.spawned) {
        this.controls.yaw = mine.yaw;
        this.spawned = true;
      }
    } else {
      this.correction.x += dx;
      this.correction.z += dz;
    }
    this.self = pos;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    this.acc += dt;
    while (this.acc >= TICK_MS) {
      this.step();
      this.acc -= TICK_MS;
    }

    const alpha = this.acc / TICK_MS;
    const decay = Math.exp(-dt / 100);
    this.correction.x *= decay;
    this.correction.z *= decay;
    const x = this.prevSelf.x + (this.self.x - this.prevSelf.x) * alpha + this.correction.x;
    const z = this.prevSelf.z + (this.self.z - this.prevSelf.z) * alpha + this.correction.z;

    const mode = this.cameraMode();
    if (mode === 'free') this.flyFreeCam(dt / 1000, x, z);
    else this.freeCam = null;
    this.updateRemotes(now);
    this.updateSelf(mode, x, z);
    this.updateCamera(mode, x, z);
    this.world.renderer.render(this.world.scene, this.world.camera);
  };

  // Spectators fly without collision; client-only, never sent to the server.
  private flyFreeCam(dt: number, x: number, z: number): void {
    const cam = (this.freeCam ??= { x, z });
    const [dx, dz] = moveDelta(this.controls.buttons(), this.controls.yaw, dt * FREE_CAM_SPEED);
    const b = officeWorld.bounds;
    cam.x = Math.max(b.minX, Math.min(b.maxX, cam.x + dx));
    cam.z = Math.max(b.minZ, Math.min(b.maxZ, cam.z + dz));
  }

  private updateSelf(mode: CameraMode, x: number, z: number): void {
    const me = this.me();
    this.selfAvatar.group.visible = mode === 'third' && !!me;
    if (!me) return;
    this.selfAvatar.setLook(me.role, me.color);
    this.selfAvatar.place(x, z, this.controls.yaw);
  }

  private updateRemotes(now: number): void {
    const players = this.snapshots.sample(now);
    const room = getState().room;
    for (const [id, state] of players) {
      let avatar = this.remotes.get(id);
      if (!avatar) {
        avatar = new Avatar();
        this.remotes.set(id, avatar);
        this.world.scene.add(avatar.group);
      }
      const info = room?.players.find((p) => p.id === id);
      avatar.setLook(info?.role ?? 'hider', info?.color ?? 0);
      avatar.place(state.x, state.z, state.yaw);
    }
    for (const [id, avatar] of this.remotes) {
      if (players.has(id)) continue;
      avatar.dispose();
      this.remotes.delete(id);
    }
  }

  private updateCamera(mode: CameraMode, x: number, z: number): void {
    const { camera } = this.world;
    const { yaw, pitch } = this.controls;
    camera.rotation.set(pitch, yaw, 0);

    if (mode === 'free' && this.freeCam) {
      camera.position.set(this.freeCam.x, FREE_CAM_HEIGHT, this.freeCam.z);
    } else if (mode === 'first') {
      camera.position.set(x, SEEKER_EYE, z);
    } else {
      // Pull the camera in when a wall is behind the player.
      const [dx, dy, dz] = directionFromAngles(yaw, pitch);
      const origin: [number, number, number] = [x, HIDER_EYE + 0.15, z];
      const hit = raycastWorld(officeWorld, { origin, dir: [-dx, -dy, -dz] }, THIRD_PERSON_DISTANCE);
      const dist = Math.max(0.35, hit - 0.15);
      camera.position.set(origin[0] - dx * dist, Math.max(0.2, origin[1] - dy * dist), origin[2] - dz * dist);
    }
  }
}
