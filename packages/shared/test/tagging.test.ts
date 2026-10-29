import { describe, expect, it } from 'vitest';
import { buildWorld, rayBox, rayCylinder, resolveTag, seekerRay, type Collider } from '../src';

const wall: Collider = { kind: 'box', center: [0, 1.6, -3], size: [6, 3.2, 0.13] };
const world = buildWorld([wall]);
const aimAt = (fromX: number, fromZ: number, x: number, z: number, y = 0.6) => {
  const dx = x - fromX;
  const dz = z - fromZ;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(y - 1.6, Math.hypot(dx, dz)) };
};

describe('raycast', () => {
  it('hits a box face and misses beside it', () => {
    const box = { min: [-1, 0, -1] as [number, number, number], max: [1, 2, 1] as [number, number, number] };
    expect(rayBox({ origin: [0, 1, 5], dir: [0, 0, -1] }, box)).toBeCloseTo(4);
    expect(rayBox({ origin: [3, 1, 5], dir: [0, 0, -1] }, box)).toBe(Infinity);
  });

  it('hits a cylinder side and its top cap', () => {
    expect(rayCylinder({ origin: [0, 0.5, 5], dir: [0, 0, -1] }, 0, 0, 0.3, 0, 1.2)).toBeCloseTo(4.7);
    expect(rayCylinder({ origin: [0, 3, 0], dir: [0, -1, 0] }, 0, 0, 0.3, 0, 1.2)).toBeCloseTo(1.8);
  });
});

describe('resolveTag', () => {
  it('tags a hider in clear view', () => {
    const { yaw, pitch } = aimAt(0, 0, 0, -2);
    expect(resolveTag(world, seekerRay(0, 0, yaw, pitch), [{ id: 'h', x: 0, z: -2 }])).toBe('h');
  });

  it('is blocked by a wall', () => {
    const { yaw, pitch } = aimAt(0, 0, 0, -4);
    expect(resolveTag(world, seekerRay(0, 0, yaw, pitch), [{ id: 'h', x: 0, z: -4 }])).toBeNull();
  });

  it('respects range', () => {
    const { yaw, pitch } = aimAt(10, 10, 10, 2);
    expect(resolveTag(world, seekerRay(10, 10, yaw, pitch), [{ id: 'h', x: 10, z: 2 }])).toBeNull();
  });

  it('picks the nearest hider', () => {
    const { yaw, pitch } = aimAt(0, 0, 0, -2);
    const hit = resolveTag(world, seekerRay(0, 0, yaw, pitch), [
      { id: 'far', x: 0, z: -2.5 },
      { id: 'near', x: 0, z: -1.5 },
    ]);
    expect(hit).toBe('near');
  });
});
