import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HIDER_SPAWNS,
  MAP_HASH,
  MAP_ID,
  PLAYER_RADIUS,
  SEEKER_SPAWN,
  officeColliders,
  officeWorld,
  overlaps,
  routeWorld,
  stepMovement,
  BUTTON,
  TICK_DT,
  type Position,
} from '@chameleon/shared';

const failures: string[] = [];
const clear = (p: Position) => !overlaps(officeWorld, p.x, p.z, PLAYER_RADIUS);

if (!clear(SEEKER_SPAWN)) failures.push('seeker spawn is blocked');
HIDER_SPAWNS.forEach((p, i) => {
  if (!clear(p)) failures.push(`hider spawn ${i} is blocked`);
});
if (HIDER_SPAWNS.length < 8) failures.push(`only ${HIDER_SPAWNS.length} hider spawns (need 8)`);

let routeSamples = 0;
for (let i = 0; i < routeWorld.length - 1; i++) {
  const a = routeWorld[i]!;
  const b = routeWorld[i + 1]!;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  for (let d = 0; d <= len; d += 0.1) {
    routeSamples++;
    const p = { x: a.x + ((b.x - a.x) * d) / len, z: a.z + ((b.z - a.z) * d) / len };
    if (!clear(p)) {
      failures.push(`route segment ${i} blocked at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
      break;
    }
  }
}

// Walk each route leg with the real movement code; it must arrive.
let walkedLegs = 0;
for (let i = 0; i < routeWorld.length - 1; i++) {
  const a = routeWorld[i]!;
  const b = routeWorld[i + 1]!;
  let pos: Position = { ...a };
  const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  const ticks = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (2 * TICK_DT)) + 5;
  for (let t = 0; t < ticks && Math.hypot(b.x - pos.x, b.z - pos.z) > 0.15; t++) {
    pos = stepMovement(pos, BUTTON.forward, yaw, TICK_DT, officeWorld);
  }
  if (Math.hypot(b.x - pos.x, b.z - pos.z) > 0.15) failures.push(`walking route leg ${i} got stuck`);
  else walkedLegs++;
}

const report = {
  map: MAP_ID,
  hash: MAP_HASH,
  colliders: officeColliders.length,
  movementObstacles: officeWorld.obstacles.length,
  occluders: officeWorld.occluders.length,
  playerRadius: PLAYER_RADIUS,
  seekerSpawn: SEEKER_SPAWN,
  hiderSpawns: HIDER_SPAWNS.length,
  routeSamples,
  walkedLegs,
  failures,
  ok: failures.length === 0,
};

const out = fileURLToPath(new URL('../packages/shared/maps/office-v6-validation.json', import.meta.url));
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
