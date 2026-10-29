import { ALARM } from "@/config/alarmClock";
import { RoundedRect, Vec2, wallInfo } from "@/game/field/fieldGeometry";
import { Rng } from "@/game/Rng";

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-9 ? { x: 1, y: 0 } : { x: v.x / len, y: v.y / len };
}

function rotate(v: Vec2, rad: number): Vec2 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export interface SteerInput {
  clock: Vec2;
  bots: Vec2[];
  field: RoundedRect;
  /** True when the clock has barely moved for a while while trying to flee. */
  stuck: boolean;
  rng: Rng;
}

/**
 * Picks the unit direction the clock tries to run in: away from the nearest bot with some
 * jitter; sliding along a wall instead of charging into it; towards the center when stuck.
 */
export function computeFleeDirection(input: SteerInput): Vec2 {
  const { clock, bots, field, stuck, rng } = input;
  const jitter = (rng.spread(ALARM.fleeJitterDeg) * Math.PI) / 180;
  const center = { x: (field.left + field.right) / 2, y: (field.top + field.bottom) / 2 };

  let dir: Vec2;
  if (stuck) {
    dir = normalize({ x: center.x - clock.x, y: center.y - clock.y });
  } else {
    let nearest: Vec2 | null = null;
    let best = Infinity;
    for (const b of bots) {
      const d = Math.hypot(b.x - clock.x, b.y - clock.y);
      if (d < best) {
        best = d;
        nearest = b;
      }
    }
    dir = nearest && best > 1e-6 ? normalize({ x: clock.x - nearest.x, y: clock.y - nearest.y }) : rotate({ x: 1, y: 0 }, rng.range(0, Math.PI * 2));
  }
  dir = rotate(dir, jitter);

  const wall = wallInfo(field, clock.x, clock.y);
  if (!stuck && wall.distance < ALARM.wallFollowDistance) {
    const n = wall.normal;
    const into = dir.x * n.x + dir.y * n.y;
    if (into < 0) {
      // Remove the component heading into the wall, keep sliding along it.
      let tangent = { x: dir.x - into * n.x, y: dir.y - into * n.y };
      if (Math.hypot(tangent.x, tangent.y) < 0.2) {
        const side = rng.next() < 0.5 ? 1 : -1;
        tangent = { x: -n.y * side, y: n.x * side };
      }
      tangent = normalize(tangent);
      dir = normalize({ x: tangent.x + n.x * ALARM.wallPushOut, y: tangent.y + n.y * ALARM.wallPushOut });
    }
  }
  return dir;
}
