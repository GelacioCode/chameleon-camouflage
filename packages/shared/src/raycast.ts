import type { Box3, World } from './collision';

export interface Ray {
  origin: [number, number, number];
  dir: [number, number, number];
}

// Matches a Three.js camera with rotation order YXZ and rotation (pitch, yaw, 0).
export function directionFromAngles(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export function rayBox(ray: Ray, box: Box3): number {
  let tMin = 0;
  let tMax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = ray.origin[i]!;
    const d = ray.dir[i]!;
    const lo = box.min[i]!;
    const hi = box.max[i]!;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

export function rayCylinder(ray: Ray, cx: number, cz: number, r: number, y0: number, y1: number): number {
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.dir;
  const fx = ox - cx;
  const fz = oz - cz;
  const inside = (x: number, z: number) => x * x + z * z <= r * r;
  if (inside(fx, fz) && oy >= y0 && oy <= y1) return 0;

  let best = Infinity;
  const a = dx * dx + dz * dz;
  if (a > 1e-12) {
    const b = 2 * (fx * dx + fz * dz);
    const c = fx * fx + fz * fz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      const y = oy + t * dy;
      if (t >= 0 && y >= y0 && y <= y1) best = t;
    }
  }
  if (Math.abs(dy) > 1e-12) {
    for (const capY of [y0, y1]) {
      const t = (capY - oy) / dy;
      if (t >= 0 && t < best && inside(fx + t * dx, fz + t * dz)) best = t;
    }
  }
  return best;
}

export function raycastWorld(world: World, ray: Ray, maxDist = Infinity): number {
  let best = maxDist;
  for (const box of world.occluders) {
    const t = rayBox(ray, box);
    if (t < best) best = t;
  }
  return best;
}
