import { BODY_MIN_Y, BODY_HEIGHT, SEEKER_EYE } from './constants';

export type Collider =
  | { kind: 'box'; center: [number, number, number]; size: [number, number, number] }
  | { kind: 'cylinder'; center: [number, number, number]; radius: number; height: number };

export type Obstacle =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export interface Box3 {
  min: [number, number, number];
  max: [number, number, number];
}

export interface World {
  obstacles: Obstacle[];
  occluders: Box3[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const yRange = (c: Collider): [number, number] => {
  const h = c.kind === 'box' ? c.size[1] : c.height;
  return [c.center[1] - h / 2, c.center[1] + h / 2];
};

// Anything overlapping the tallest body (seeker eye height) blocks movement.
export function buildWorld(colliders: Collider[]): World {
  const bodyTop = Math.max(BODY_HEIGHT, SEEKER_EYE);
  const obstacles: Obstacle[] = [];
  const occluders: Box3[] = [];
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  for (const c of colliders) {
    const [y0, y1] = yRange(c);
    const [cx, cy, cz] = c.center;
    if (c.kind === 'box') {
      const [w, h, d] = c.size;
      const box: Box3 = {
        min: [cx - w / 2, cy - h / 2, cz - d / 2],
        max: [cx + w / 2, cy + h / 2, cz + d / 2],
      };
      occluders.push(box);
      bounds.minX = Math.min(bounds.minX, box.min[0]);
      bounds.maxX = Math.max(bounds.maxX, box.max[0]);
      bounds.minZ = Math.min(bounds.minZ, box.min[2]);
      bounds.maxZ = Math.max(bounds.maxZ, box.max[2]);
      if (y1 > BODY_MIN_Y && y0 < bodyTop)
        obstacles.push({ kind: 'box', minX: box.min[0], maxX: box.max[0], minZ: box.min[2], maxZ: box.max[2] });
    } else if (y1 > BODY_MIN_Y && y0 < bodyTop) {
      // Chair cylinders block movement but not line of sight.
      obstacles.push({ kind: 'circle', x: cx, z: cz, r: c.radius });
    }
  }
  return { obstacles, occluders, bounds };
}

export function overlaps(world: World, x: number, z: number, radius: number): boolean {
  const b = world.bounds;
  if (x - radius < b.minX || x + radius > b.maxX || z - radius < b.minZ || z + radius > b.maxZ) return true;
  const r2 = radius * radius;
  for (const o of world.obstacles) {
    if (o.kind === 'box') {
      const dx = Math.max(o.minX - x, 0, x - o.maxX);
      const dz = Math.max(o.minZ - z, 0, z - o.maxZ);
      if (dx * dx + dz * dz < r2) return true;
    } else {
      const rr = o.r + radius;
      const dx = x - o.x;
      const dz = z - o.z;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
  }
  return false;
}
