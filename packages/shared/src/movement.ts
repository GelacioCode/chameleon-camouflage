import { BUTTON, MAX_MOVE_STEP, PITCH_LIMIT, PLAYER_RADIUS, SPRINT_SPEED, WALK_SPEED } from './constants';
import { overlaps, type World } from './collision';

export interface Position {
  x: number;
  z: number;
}

export const clampPitch = (pitch: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));

export function wrapAngle(a: number): number {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

export function moveDelta(buttons: number, yaw: number, dt: number): [number, number] {
  const f = (buttons & BUTTON.forward ? 1 : 0) - (buttons & BUTTON.back ? 1 : 0);
  const s = (buttons & BUTTON.right ? 1 : 0) - (buttons & BUTTON.left ? 1 : 0);
  if (!f && !s) return [0, 0];
  const len = Math.hypot(f, s);
  const speed = (buttons & BUTTON.sprint ? SPRINT_SPEED : WALK_SPEED) * dt;
  return [
    ((-Math.sin(yaw) * f + Math.cos(yaw) * s) / len) * speed,
    ((-Math.cos(yaw) * f - Math.sin(yaw) * s) / len) * speed,
  ];
}

// Substepped, per-axis sliding so walls can't be tunnelled and corners don't trap.
export function stepMovement(pos: Position, buttons: number, yaw: number, dt: number, world: World): Position {
  const [dx, dz] = moveDelta(buttons, yaw, dt);
  if (!dx && !dz) return pos;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / MAX_MOVE_STEP));
  let { x, z } = pos;
  // A body already inside geometry may move freely so it can get out.
  const stuck = overlaps(world, x, z, PLAYER_RADIUS);
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (stuck || !overlaps(world, nx, z, PLAYER_RADIUS)) x = nx;
    const nz = z + dz / steps;
    if (stuck || !overlaps(world, x, nz, PLAYER_RADIUS)) z = nz;
  }
  return { x, z };
}
