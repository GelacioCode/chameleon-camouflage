import { BODY_HEIGHT, HIT_RADIUS, SEEKER_EYE, TAG_RANGE } from './constants';
import type { World } from './collision';
import { directionFromAngles, rayCylinder, raycastWorld, type Ray } from './raycast';

export interface TagTarget {
  id: string;
  x: number;
  z: number;
}

export function seekerRay(x: number, z: number, yaw: number, pitch: number): Ray {
  return { origin: [x, SEEKER_EYE, z], dir: directionFromAngles(yaw, pitch) };
}

// Nearest hider body along the ray, unless map geometry is closer.
export function resolveTag(world: World, ray: Ray, targets: TagTarget[], range = TAG_RANGE): string | null {
  let bestT = range;
  let bestId: string | null = null;
  for (const target of targets) {
    const t = rayCylinder(ray, target.x, target.z, HIT_RADIUS, 0, BODY_HEIGHT);
    if (t < bestT) {
      bestT = t;
      bestId = target.id;
    }
  }
  if (!bestId) return null;
  return raycastWorld(world, ray, bestT) < bestT ? null : bestId;
}
