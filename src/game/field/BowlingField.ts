import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import { COLORS } from "@/config/theme";
import {
  DIVIDER,
  FOUL_LINE_X,
  HALL,
  HEAD_PIN_X,
  LANE_CENTER,
  LANE_HALF,
  LANE_HEIGHT,
  WALL_RESTITUTION,
} from "@/config/bowling";
import { WALL_PHYSICS } from "@/config/physics";
import { CREAM, addSign } from "@/game/field/stadium";
import { Rng } from "@/game/Rng";
import { addBackdrop } from "@/game/view/bake";
import { WORLD_LEFT, WORLD_WIDTH } from "@/config/viewport";
import { FONTS } from "@/config/theme";

const TEXTURE_KEY = "botz-bowling-bg";
const WALL_THICKNESS = 60;
const FLOOR = 0x1c1530;
const FLOOR_STRIPE = 0x241a3d;
const WOOD_A = 0xdca966;
const WOOD_B = 0xd09a58;
const WOOD_SEAM = 0xa8743a;
const APPROACH = 0xe6bb80;
const GUTTER = 0x2a2d40;
const GUTTER_GROOVE = 0x13152a;
const GUTTER_LIGHT = 0x5b6180;

/**
 * Bowling hall: two lanes (red on top, yellow below), each with approach, foul line, arrows, pin deck
 * and pit, painted once; the walls around and between the lanes are the only collision geometry.
 */
export class BowlingField {
  constructor(private readonly scene: Phaser.Scene) {
    addBackdrop(scene, TEXTURE_KEY, (g) => this.paintBackdrop(g));
    this.buildWalls();
    this.addDecor();
  }

  private buildWalls(): void {
    const { left, right, top, bottom } = HALL;
    const t = WALL_THICKNESS;
    const w = right - left;
    const h = bottom - top;
    const wall = (cx: number, cy: number, width: number, height: number) =>
      this.scene.matter.add.rectangle(cx, cy, width, height, {
        isStatic: true,
        restitution: WALL_RESTITUTION,
        friction: WALL_PHYSICS.friction,
        label: "wall",
      });
    wall(left + w / 2, top - t / 2, w + 2 * t, t);
    wall(left + w / 2, bottom + t / 2, w + 2 * t, t);
    wall(left - t / 2, top + h / 2, t, h);
    wall(right + t / 2, top + h / 2, t, h);
    wall(left + w / 2, (top + bottom) / 2, w, DIVIDER);
  }

  private paintBackdrop(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(FLOOR, 1);
    g.fillRect(WORLD_LEFT, 0, WORLD_WIDTH, GAME_HEIGHT);
    // Carpet stripes with a few neon squiggles, like a bowling alley floor.
    g.fillStyle(FLOOR_STRIPE, 1);
    for (let x = WORLD_LEFT - 200; x < GAME_WIDTH; x += 120) g.fillTriangle(x, 0, x + 60, 0, x, GAME_HEIGHT);
    const rng = new Rng(0xb041);
    const neon = [0xff4f9a, 0x4fd6ff, 0xf6c234];
    for (let i = 0; i < 22; i++) {
      const x = WORLD_LEFT + rng.range(0, WORLD_WIDTH);
      const y = i % 2 ? rng.range(98, HALL.top - 12) : rng.range(HALL.bottom + 12, GAME_HEIGHT - 8);
      g.lineStyle(3, neon[i % 3], 0.45);
      g.strokeCircle(x, y, rng.range(5, 12));
    }

    for (const team of ["red", "yellow"] as TeamId[]) this.paintLane(g, team);

    // Ball return / divider between the lanes.
    const dy = HALL.top + LANE_HEIGHT;
    g.fillStyle(0x23273d, 1);
    g.fillRect(HALL.left, dy, HALL.right - HALL.left, DIVIDER);
    g.fillStyle(0x3a4062, 1);
    g.fillRect(HALL.left, dy + 4, HALL.right - HALL.left, 4);
    g.fillRect(HALL.left, dy + DIVIDER - 8, HALL.right - HALL.left, 4);
    for (let x = HALL.left + 40; x < HALL.right; x += 90) {
      g.fillStyle(x % 180 < 90 ? TEAM_COLORS.red : TEAM_COLORS.yellow, 0.9);
      g.fillCircle(x, dy + DIVIDER / 2, 5);
    }
  }

  private paintLane(g: Phaser.GameObjects.Graphics, team: TeamId): void {
    const cy = LANE_CENTER[team];
    const top = cy - LANE_HALF;
    const bottom = cy + LANE_HALF;
    const { left, right } = HALL;
    const outer = team === "red" ? -1 : 1; // which side of the lane faces the hall wall
    const color = TEAM_COLORS[team];

    // Gutters, with a groove and a bright rim.
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? cy - LANE_HEIGHT / 2 : bottom;
      g.fillStyle(GUTTER, 1);
      g.fillRect(left, y0, right - left, LANE_HEIGHT / 2 - LANE_HALF);
      g.fillStyle(GUTTER_GROOVE, 1);
      const gy = y0 + (LANE_HEIGHT / 2 - LANE_HALF) / 2;
      g.fillRect(left, gy - 9, right - left, 18);
      g.fillStyle(GUTTER_LIGHT, 0.7);
      g.fillRect(left, side < 0 ? y0 + (LANE_HEIGHT / 2 - LANE_HALF) - 3 : y0, right - left, 3);
    }

    // Wooden lane: long boards, slightly different tones.
    const boards = 16;
    const bh = (LANE_HALF * 2) / boards;
    for (let i = 0; i < boards; i++) {
      g.fillStyle(i % 2 ? WOOD_A : WOOD_B, 1);
      g.fillRect(left, top + i * bh, right - left, bh);
      g.fillStyle(WOOD_SEAM, 0.55);
      g.fillRect(left, top + i * bh, right - left, 1.5);
    }
    // Approach: lighter wood with its dots, then the foul line.
    g.fillStyle(APPROACH, 1);
    g.fillRect(left, top, FOUL_LINE_X - left, LANE_HALF * 2);
    g.fillStyle(WOOD_SEAM, 0.45);
    for (let i = 0; i < boards; i++) g.fillRect(left, top + i * bh, FOUL_LINE_X - left, 1.5);
    g.fillStyle(0x5b3a1e, 0.55);
    for (let k = 0; k < 7; k++) g.fillCircle(FOUL_LINE_X - 36, cy + (k - 3) * 30, 4);
    g.fillStyle(0x2b2233, 1);
    g.fillRect(FOUL_LINE_X, top, 7, LANE_HALF * 2);

    // Shiny oil, arrows (a dart pattern) and the pin deck.
    g.fillStyle(0xffffff, 0.07);
    g.fillRect(FOUL_LINE_X + 7, cy - 70, HEAD_PIN_X - FOUL_LINE_X - 90, 140);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(FOUL_LINE_X + 7, cy - 38, HEAD_PIN_X - FOUL_LINE_X - 90, 76);
    g.fillStyle(WOOD_SEAM, 0.85);
    for (let k = -3; k <= 3; k++) {
      const ax = 640 + (3 - Math.abs(k)) * 34;
      const ay = cy + k * 32;
      g.fillTriangle(ax, ay, ax - 24, ay - 11, ax - 24, ay + 11);
    }
    g.fillStyle(0x000000, 0.12);
    g.fillRect(HEAD_PIN_X - 60, top, HALL.right - HEAD_PIN_X + 60, LANE_HALF * 2);
    g.fillStyle(WOOD_SEAM, 0.5);
    for (let k = 0; k < 4; k++) g.fillCircle(HEAD_PIN_X + k * 38 - 26, cy + (k % 2 ? 56 : -56), 3);

    // Pit behind the pins: dark, with a striped curtain.
    const pitX = HALL.right - 44;
    g.fillStyle(0x0b0916, 1);
    g.fillRect(pitX, cy - LANE_HEIGHT / 2, 44, LANE_HEIGHT);
    g.fillStyle(0x251c3d, 1);
    for (let y = cy - LANE_HEIGHT / 2; y < cy + LANE_HEIGHT / 2; y += 20) g.fillRect(pitX, y, 44, 10);

    // Team stripe on the hall side, and the lane name.
    const edgeY = outer < 0 ? cy - LANE_HEIGHT / 2 : cy + LANE_HEIGHT / 2 - 8;
    g.fillStyle(color, 1);
    g.fillRect(left, edgeY, right - left, 8);
  }

  private addDecor(): void {
    for (const team of ["red", "yellow"] as TeamId[]) {
      const cy = LANE_CENTER[team];
      this.scene.add
        .text(HALL.left + 14, cy + (team === "red" ? -LANE_HEIGHT / 2 + 14 : LANE_HEIGHT / 2 - 40), team === "red" ? "PISTE ROUGE" : "PISTE JAUNE", {
          fontFamily: FONTS.title,
          fontSize: "20px",
          color: team === "red" ? "#ff8a84" : "#f6c234",
        })
        .setDepth(-9)
        .setAlpha(0.9);
    }
    addSign(this.scene, 560, 118, 220, 34, -2, CREAM, [{ text: "STRIKE ZONE", color: "#d63a33", size: 18 }]);
    addSign(this.scene, 1050, 118, 220, 34, 2, CREAM, [{ text: "QUILLES & CO", color: COLORS.ink, size: 18 }]);
  }
}
