import { INTERP_DELAY_MS, wrapAngle, type PlayerState } from '@chameleon/shared';

interface Frame {
  at: number;
  players: Map<string, PlayerState>;
}

const KEEP_MS = 1000;

export class SnapshotBuffer {
  private frames: Frame[] = [];

  push(at: number, players: PlayerState[]): void {
    this.frames.push({ at, players: new Map(players.map((p) => [p.id, p])) });
    while (this.frames.length > 2 && this.frames[0]!.at < at - KEEP_MS) this.frames.shift();
  }

  clear(): void {
    this.frames = [];
  }

  /** Remote players rendered slightly in the past, blended between snapshots. */
  sample(now: number): Map<string, PlayerState> {
    const t = now - INTERP_DELAY_MS;
    const frames = this.frames;
    if (!frames.length) return new Map();
    let i = frames.length - 1;
    while (i > 0 && frames[i - 1]!.at > t) i--;
    const b = frames[i]!;
    const a = frames[i - 1];
    if (!a || t >= b.at) return b.players;

    const k = Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at)));
    const out = new Map<string, PlayerState>();
    for (const [id, pb] of b.players) {
      const pa = a.players.get(id);
      if (!pa) {
        out.set(id, pb);
        continue;
      }
      out.set(id, {
        id,
        x: pa.x + (pb.x - pa.x) * k,
        z: pa.z + (pb.z - pa.z) * k,
        yaw: pa.yaw + wrapAngle(pb.yaw - pa.yaw) * k,
        pitch: pa.pitch + (pb.pitch - pa.pitch) * k,
      });
    }
    return out;
  }
}
