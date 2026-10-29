import colliderData from '../maps/office-v6-colliders.json';
import mapDefinition from '../maps/office-map.json';
import { PLAYER_RADIUS, PROTOCOL_VERSION } from './constants';
import { buildWorld, overlaps, type Collider } from './collision';
import type { Position } from './movement';

export { mapDefinition };

export const MAP_ID = colliderData.mapId;
export const officeColliders = colliderData.colliders as Collider[];
export const officeWorld = buildWorld(officeColliders);

const fnv1a = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

export const MAP_HASH = fnv1a(JSON.stringify(officeColliders));
export const BUILD_ID = `p${PROTOCOL_VERSION}-${MAP_ID}-${MAP_HASH}`;

const { metersPerPixel, originPx } = mapDefinition.source;
export const pxToWorld = (px: number, pz: number): Position => ({
  x: (px - originPx[0]!) * metersPerPixel,
  z: (pz - originPx[1]!) * metersPerPixel,
});

export const SEEKER_SPAWN: Position = { x: colliderData.spawn[0]!, z: colliderData.spawn[2]! };

export const routeWorld: Position[] = mapDefinition.routePx.map(([x, z]) => pxToWorld(x!, z!));

const SPAWN_SPACING = 2.5;
const SPAWN_CLEARANCE = 0.25;
const SPAWN_MIN_SEEKER_DISTANCE = 8;

// Hiders spawn along the validated walkthrough route, away from the seeker.
function computeHiderSpawns(): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < routeWorld.length - 1; i++) {
    const a = routeWorld[i]!;
    const b = routeWorld[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 0; d < len; d += SPAWN_SPACING) {
      const p = { x: a.x + ((b.x - a.x) * d) / len, z: a.z + ((b.z - a.z) * d) / len };
      if (Math.hypot(p.x - SEEKER_SPAWN.x, p.z - SEEKER_SPAWN.z) < SPAWN_MIN_SEEKER_DISTANCE) continue;
      if (overlaps(officeWorld, p.x, p.z, PLAYER_RADIUS + SPAWN_CLEARANCE)) continue;
      if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < SPAWN_SPACING * 0.9)) continue;
      out.push(p);
    }
  }
  return out;
}

export const HIDER_SPAWNS = computeHiderSpawns();
