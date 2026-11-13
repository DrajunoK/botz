import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TeamId, BOTZ_PER_TEAM } from "@/config/game";
import { WALL_PHYSICS } from "@/config/physics";
import { COLORS } from "@/config/theme";
import { RoundedRect, halfHeightAt } from "@/game/field/fieldGeometry";
import { CREAM, addAds, addSign, fillRounded, paintCrowd, paintRim, strokeRounded } from "@/game/field/stadium";
import { bakeTexture } from "@/game/view/bake";

export const FIELD_LEFT = 190;
export const FIELD_RIGHT = GAME_WIDTH - 190;
export const FIELD_TOP = 130;
export const FIELD_BOTTOM = GAME_HEIGHT - 130;
export const CORNER_RADIUS = 190;
export const WALL_THICKNESS = 24;

export const GOAL_HALF_HEIGHT = 110;
export const GOAL_DEPTH = 90;
export const GOAL_CENTER_Y = (FIELD_TOP + FIELD_BOTTOM) / 2;
export const GOAL_TOP_Y = GOAL_CENTER_Y - GOAL_HALF_HEIGHT;
export const GOAL_BOTTOM_Y = GOAL_CENTER_Y + GOAL_HALF_HEIGHT;

const CORNER_SEGMENTS = 12;

/** The pitch outline (the white border line): what everything bounces on. */
export const FIELD_RECT: RoundedRect = {
  left: FIELD_LEFT,
  right: FIELD_RIGHT,
  top: FIELD_TOP,
  bottom: FIELD_BOTTOM,
  radius: CORNER_RADIUS,
};

/** Liang–Barsky clip of a segment to a rectangle; null when nothing is left. */
function clipSegment(x0: number, y0: number, x1: number, y1: number, left: number, top: number, right: number, bottom: number): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const checks: [number, number][] = [
    [-dx, x0 - left],
    [dx, right - x0],
    [-dy, y0 - top],
    [dy, bottom - y0],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 >= t1) return null;
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

const STRIPE_WIDTH = 44;
const FIELD_TEXTURE_KEY = "botz-field-bg";

export interface GoalZone {
  /** The team that DEFENDS this goal (scoring here is a goal for the opposite team). */
  defendingTeam: TeamId;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Builds and renders the stadium-shaped soccer pitch: a rounded-corner rectangle
 * border with two goal openings (left and right), plus the goal "pocket" walls.
 */
export class SoccerField {
  private scene: Phaser.Scene;
  readonly leftGoal: GoalZone;
  readonly rightGoal: GoalZone;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.leftGoal = {
      defendingTeam: "red",
      left: FIELD_LEFT - GOAL_DEPTH,
      right: FIELD_LEFT,
      top: GOAL_TOP_Y,
      bottom: GOAL_BOTTOM_Y,
    };
    this.rightGoal = {
      defendingTeam: "yellow",
      left: FIELD_RIGHT,
      right: FIELD_RIGHT + GOAL_DEPTH,
      top: GOAL_TOP_Y,
      bottom: GOAL_BOTTOM_Y,
    };

    this.buildCollision();
    this.render();
  }

  /** Returns spawn positions (kickoff formation) for a team, index 0..BOTZ_PER_TEAM-1. */
  static spawnPositionsFor(team: TeamId): Point[] {
    const nearX = team === "red" ? FIELD_LEFT + 190 : FIELD_RIGHT - 190;
    const farX = team === "red" ? FIELD_LEFT + 430 : FIELD_RIGHT - 430;
    return [
      { x: nearX, y: GOAL_CENTER_Y },
      { x: farX, y: GOAL_CENTER_Y - 160 },
      { x: farX, y: GOAL_CENTER_Y + 160 },
    ].slice(0, BOTZ_PER_TEAM);
  }

  static clockSpawnPosition(): Point {
    return { x: (FIELD_LEFT + FIELD_RIGHT) / 2, y: GOAL_CENTER_Y };
  }

  /** True once the clock (given its center and radius) is entirely past the goal line. */
  static isFullyInGoal(zone: GoalZone, x: number, y: number, radius: number): boolean {
    if (y - radius < zone.top || y + radius > zone.bottom) return false;
    if (zone.defendingTeam === "red") return x + radius < FIELD_LEFT;
    return x - radius > FIELD_RIGHT;
  }

  // ───────────────────────────── collision ─────────────────────────────

  private addSegment(a: Point, b: Point, thickness = WALL_THICKNESS) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const length = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const angle = Phaser.Math.Angle.Between(a.x, a.y, b.x, b.y);
    this.scene.matter.add.rectangle(cx, cy, length + thickness, thickness, {
      isStatic: true,
      angle,
      restitution: WALL_PHYSICS.restitution,
      friction: WALL_PHYSICS.friction,
      label: "wall",
    });
  }

  private arcPoints(center: Point, radius: number, startAngle: number, endAngle: number): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const t = startAngle + ((endAngle - startAngle) * i) / CORNER_SEGMENTS;
      pts.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
    }
    return pts;
  }

  private addPolyline(points: Point[]) {
    for (let i = 0; i < points.length - 1; i++) this.addSegment(points[i], points[i + 1]);
  }

  private buildCollision(): void {
    const r = CORNER_RADIUS;
    const TL = { x: FIELD_LEFT + r, y: FIELD_TOP + r };
    const TR = { x: FIELD_RIGHT - r, y: FIELD_TOP + r };
    const BR = { x: FIELD_RIGHT - r, y: FIELD_BOTTOM - r };
    const BL = { x: FIELD_LEFT + r, y: FIELD_BOTTOM - r };

    this.addSegment({ x: TL.x, y: FIELD_TOP }, { x: TR.x, y: FIELD_TOP });
    this.addPolyline(this.arcPoints(TR, r, -Math.PI / 2, 0));
    this.addSegment({ x: FIELD_RIGHT, y: TR.y }, { x: FIELD_RIGHT, y: GOAL_TOP_Y });
    this.addSegment({ x: FIELD_RIGHT, y: GOAL_BOTTOM_Y }, { x: FIELD_RIGHT, y: BR.y });
    this.addPolyline(this.arcPoints(BR, r, 0, Math.PI / 2));
    this.addSegment({ x: BR.x, y: FIELD_BOTTOM }, { x: BL.x, y: FIELD_BOTTOM });
    this.addPolyline(this.arcPoints(BL, r, Math.PI / 2, Math.PI));
    this.addSegment({ x: FIELD_LEFT, y: BL.y }, { x: FIELD_LEFT, y: GOAL_BOTTOM_Y });
    this.addSegment({ x: FIELD_LEFT, y: GOAL_TOP_Y }, { x: FIELD_LEFT, y: TL.y });
    this.addPolyline(this.arcPoints(TL, r, Math.PI, (3 * Math.PI) / 2));

    this.buildGoalPocket(this.leftGoal, -1);
    this.buildGoalPocket(this.rightGoal, 1);
  }

  private buildGoalPocket(zone: GoalZone, dir: -1 | 1): void {
    const lineX = dir === -1 ? FIELD_LEFT : FIELD_RIGHT;
    const backX = dir === -1 ? zone.left : zone.right;
    this.addSegment({ x: lineX, y: GOAL_TOP_Y }, { x: backX, y: GOAL_TOP_Y });
    this.addSegment({ x: lineX, y: GOAL_BOTTOM_Y }, { x: backX, y: GOAL_BOTTOM_Y });
    this.addSegment({ x: backX, y: GOAL_TOP_Y }, { x: backX, y: GOAL_BOTTOM_Y });
  }

  // ───────────────────────────── rendering ─────────────────────────────

  private render(): void {
    bakeTexture(this.scene, FIELD_TEXTURE_KEY, GAME_WIDTH, GAME_HEIGHT, (g) => this.paintStatic(g));
    this.scene.add.image(0, 0, FIELD_TEXTURE_KEY).setOrigin(0, 0).setDepth(-20);
    this.addAds();
    this.addCrowdSigns();
  }

  private paintStatic(g: Phaser.GameObjects.Graphics): void {
    // Night backdrop.
    g.fillStyle(COLORS.night, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    paintCrowd(g);
    paintRim(g);

    this.paintGoalNet(g, this.leftGoal);
    this.paintGoalNet(g, this.rightGoal);
    this.paintTurf(g);
    this.paintMarkings(g);
  }

  private paintTurf(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.turfA, 1);
    fillRounded(g, FIELD_RECT);

    // Alternate mow stripes, clipped to the rounded pitch by sampling its outline.
    g.fillStyle(COLORS.turfB, 1);
    for (let x0 = FIELD_LEFT + STRIPE_WIDTH; x0 < FIELD_RIGHT; x0 += STRIPE_WIDTH * 2) {
      const x1 = Math.min(x0 + STRIPE_WIDTH, FIELD_RIGHT);
      const top: Phaser.Math.Vector2[] = [];
      const bottom: Phaser.Math.Vector2[] = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const h = halfHeightAt(FIELD_RECT, x);
        top.push(new Phaser.Math.Vector2(x, GOAL_CENTER_Y - h));
        bottom.push(new Phaser.Math.Vector2(x, GOAL_CENTER_Y + h));
      }
      g.fillPoints([...top, ...bottom.reverse()], true);
    }

    g.lineStyle(8, COLORS.lineBorder, 1);
    strokeRounded(g, FIELD_RECT);
  }

  private paintMarkings(g: Phaser.GameObjects.Graphics): void {
    const cx = GAME_WIDTH / 2;
    g.lineStyle(4, COLORS.line, 0.8);
    g.lineBetween(cx, FIELD_TOP + 4, cx, FIELD_BOTTOM - 4);
    g.strokeCircle(cx, GOAL_CENTER_Y, 80);
    g.fillStyle(COLORS.line, 0.8);
    g.fillCircle(cx, GOAL_CENTER_Y, 6);

    // Goal-area arcs.
    for (const dir of [1, -1] as const) {
      const x = dir === 1 ? FIELD_LEFT : FIELD_RIGHT;
      g.lineStyle(4, COLORS.line, 0.8);
      g.beginPath();
      const a0 = dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      g.arc(x, GOAL_CENTER_Y, 150, a0, a0 + Math.PI);
      g.strokePath();
    }

    // Patch the border line across each goal mouth, then add the posts.
    g.fillStyle(COLORS.turfA, 1);
    g.fillRect(FIELD_LEFT - 5, GOAL_TOP_Y, 10, GOAL_BOTTOM_Y - GOAL_TOP_Y);
    g.fillRect(FIELD_RIGHT - 5, GOAL_TOP_Y, 10, GOAL_BOTTOM_Y - GOAL_TOP_Y);
    for (const x of [FIELD_LEFT, FIELD_RIGHT]) {
      for (const y of [GOAL_TOP_Y, GOAL_BOTTOM_Y]) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y, 9);
        g.lineStyle(2, 0x9aa6bf, 1);
        g.strokeCircle(x, y, 9);
      }
    }
  }

  /** Net: dark mesh with diagonal lines inside a white frame, like the mockup's `net` pattern. */
  private paintGoalNet(g: Phaser.GameObjects.Graphics, zone: GoalZone): void {
    const w = zone.right - zone.left;
    const h = zone.bottom - zone.top;
    g.fillStyle(COLORS.netBg, 1);
    g.fillRoundedRect(zone.left, zone.top, w, h, 14);

    g.lineStyle(1.5, COLORS.netLine, 1);
    const step = 14;
    for (let o = -h; o <= w + h; o += step) {
      for (const [ax, ay, bx, by] of [
        [zone.left + o, zone.top, zone.left + o + h, zone.bottom],
        [zone.left + o + h, zone.top, zone.left + o, zone.bottom],
      ]) {
        const seg = clipSegment(ax, ay, bx, by, zone.left, zone.top, zone.right, zone.bottom);
        if (seg) g.lineBetween(seg[0], seg[1], seg[2], seg[3]);
      }
    }

    g.lineStyle(6, COLORS.lineBorder, 1);
    g.strokeRoundedRect(zone.left, zone.top, w, h, 14);
  }

  private addAds(): void {
    addAds(this.scene, [
      ["BOULONS & FILS", 560, 103],
      ["HUILE EXTRA-FINE", 1040, 103],
      ["PIÈCES DÉTACHÉES", 560, GAME_HEIGHT - 103],
      ["RÉPARATION EXPRESS", 1040, GAME_HEIGHT - 103],
    ]);
  }

  /** Cream / yellow signs stuck on the stands, tilted like in the mockup. */
  private addCrowdSigns(): void {
    addSign(this.scene, 520, 40, 180, 38, -3, CREAM, [{ text: "DRIIING !", color: "#d63a33", size: 20 }]);
    addSign(this.scene, 1120, 40, 210, 38, 3, CREAM, [{ text: "RENDS TA ROUE", color: COLORS.ink, size: 18 }]);
    addSign(this.scene, 48, 380, 86, 66, -7, CREAM, [
      { text: "GO", color: "#d63a33", size: 20 },
      { text: "ROUGE", color: "#d63a33", size: 16 },
    ]);
    addSign(this.scene, GAME_WIDTH - 48, 520, 86, 66, 6, COLORS.yellow, [
      { text: "GO", color: COLORS.ink, size: 20 },
      { text: "JAUNE", color: COLORS.ink, size: 16 },
    ]);
  }
}
