import { describe, expect, it } from 'vitest';
import {
  BUTTON,
  PLAYER_RADIUS,
  TICK_DT,
  WALK_SPEED,
  buildWorld,
  moveDelta,
  officeWorld,
  overlaps,
  stepMovement,
  SEEKER_SPAWN,
  type Collider,
} from '../src';

const wall: Collider = { kind: 'box', center: [0, 1.6, -2], size: [10, 3.2, 0.13] };
const room = buildWorld([wall]);
room.bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

describe('movement', () => {
  it('does not make diagonals faster', () => {
    const [fx, fz] = moveDelta(BUTTON.forward, 0, 1);
    const [dx, dz] = moveDelta(BUTTON.forward | BUTTON.right, 0, 1);
    expect(Math.hypot(fx, fz)).toBeCloseTo(WALK_SPEED);
    expect(Math.hypot(dx, dz)).toBeCloseTo(WALK_SPEED);
  });

  it('stops at a wall and slides along it', () => {
    let pos = { x: 0, z: 0 };
    for (let i = 0; i < 60; i++) pos = stepMovement(pos, BUTTON.forward | BUTTON.right, 0, TICK_DT, room);
    expect(pos.z).toBeGreaterThan(-2 + 0.065 + PLAYER_RADIUS - 1e-6);
    expect(pos.x).toBeGreaterThan(1);
  });

  it('cannot tunnel through a thin wall in one large step', () => {
    const pos = stepMovement({ x: 0, z: 0 }, BUTTON.forward | BUTTON.sprint, 0, 2, room);
    expect(pos.z).toBeGreaterThan(-2);
  });

  it('never ends inside office geometry from a clear start', () => {
    let pos = { ...SEEKER_SPAWN };
    let yaw = 0;
    for (let i = 0; i < 2000; i++) {
      yaw += 0.37;
      pos = stepMovement(pos, BUTTON.forward | BUTTON.sprint, yaw, TICK_DT, officeWorld);
      expect(overlaps(officeWorld, pos.x, pos.z, PLAYER_RADIUS)).toBe(false);
    }
  });
});
