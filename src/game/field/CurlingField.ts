import Phaser from "phaser";
import { GAME_HEIGHT, TEAM_COLORS, TeamId } from "@/config/game";
import { COLORS } from "@/config/theme";
import {
  BOARD_RESTITUTION,
  BOARD_THICKNESS,
  CIRCLE_CENTER,
  CIRCLE_RADIUS,
  HOUSE_CENTER,
  HOUSE_RINGS,
  ICE,
} from "@/config/curling";
import { WALL_PHYSICS } from "@/config/physics";
import { CREAM, addAds, addSign, paintCrowd, paintRim } from "@/game/field/stadium";
import { EndResult } from "@/game/petanque";
import { showMeasure } from "@/game/field/measure";
import { Rng } from "@/game/Rng";
import { addBackdrop } from "@/game/view/bake";
import { WORLD_LEFT, WORLD_WIDTH } from "@/config/viewport";

const TEXTURE_KEY = "botz-curling-bg";
const WALL_THICKNESS = 60;
const ICE_LIGHT = 0xe4f4fc;
const ICE_SHADE = 0xcfe8f5;
const RING_BLUE = 0x4b8fd6;
const RING_BLUE_EDGE = 0x2d6ab0;
const RING_RED = 0xe8473f;
const RING_RED_EDGE = 0xa52e29;
const ICE_LINE = 0x9fc4dc;

/**
 * Curling sheet: stands, blue boards and a pale sheet of ice (baked once), the target on the right,
 * the two throwing circles with the botz still to throw, and the boards' collision walls.
 */
export class CurlingField {
  private readonly remaining: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    addBackdrop(scene, TEXTURE_KEY, (g) => this.paintBackdrop(g));
    this.remaining = scene.add.graphics().setDepth(-9);
    this.buildWalls();
    this.addDecor();
  }

  /** Little bot icons beside each circle: the botz that team still has to throw this end. */
  setRemaining(counts: Record<TeamId, number>): void {
    const g = this.remaining;
    g.clear();
    for (const team of ["red", "yellow"] as TeamId[]) {
      const c = CIRCLE_CENTER[team];
      for (let i = 0; i < counts[team]; i++) {
        const x = ICE.left + 26;
        const y = c.y - 24 + i * 24;
        g.fillStyle(TEAM_COLORS[team], 1);
        g.fillRoundedRect(x - 12, y - 8, 24, 16, 8);
        g.fillStyle(COLORS.botVisor, 1);
        g.fillRoundedRect(x - 6, y - 3, 12, 5, 2.5);
      }
    }
  }

  showMeasure(center: { x: number; y: number }, result: EndResult): () => void {
    return showMeasure(this.scene, center, result);
  }

  private buildWalls(): void {
    const { left, right, top, bottom } = ICE;
    const t = WALL_THICKNESS;
    const w = right - left;
    const h = bottom - top;
    const wall = (cx: number, cy: number, width: number, height: number) =>
      this.scene.matter.add.rectangle(cx, cy, width, height, {
        isStatic: true,
        restitution: BOARD_RESTITUTION,
        friction: WALL_PHYSICS.friction,
        label: "wall",
      });
    wall(left + w / 2, top - t / 2, w + 2 * t, t);
    wall(left + w / 2, bottom + t / 2, w + 2 * t, t);
    wall(left - t / 2, top + h / 2, t, h);
    wall(right + t / 2, top + h / 2, t, h);
  }

  private paintBackdrop(g: Phaser.GameObjects.Graphics): void {
    const { left, right, top, bottom } = ICE;
    const bt = BOARD_THICKNESS;
    g.fillStyle(COLORS.night, 1);
    g.fillRect(WORLD_LEFT, 0, WORLD_WIDTH, GAME_HEIGHT);
    paintCrowd(g);
    paintRim(g);

    // Boards: dark blue frame with a white cap, like a rink.
    g.fillStyle(0x16335a, 1);
    g.fillRoundedRect(left - bt - 4, top - bt - 4, right - left + 2 * bt + 8, bottom - top + 2 * bt + 8, 46);
    g.fillStyle(0x2456a0, 1);
    g.fillRoundedRect(left - bt, top - bt, right - left + 2 * bt, bottom - top + 2 * bt, 42);
    g.lineStyle(4, 0xf4f7fb, 1);
    g.strokeRoundedRect(left - bt + 2, top - bt + 2, right - left + 2 * bt - 4, bottom - top + 2 * bt - 4, 40);

    // Ice, with a faint banding and scratches (fixed seed: same sheet every time).
    g.fillStyle(ICE_LIGHT, 1);
    g.fillRoundedRect(left, top, right - left, bottom - top, 22);
    g.fillStyle(ICE_SHADE, 0.55);
    for (let y = top + 20; y < bottom; y += 64) g.fillRect(left, y, right - left, 26);
    const rng = new Rng(0xc0ffee);
    g.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 70; i++) {
      const x = rng.range(left + 20, right - 140);
      const y = rng.range(top + 14, bottom - 14);
      g.lineBetween(x, y, x + rng.range(30, 120), y + rng.range(-6, 6));
    }
    g.lineStyle(3, ICE_LINE, 0.9);
    g.strokeRoundedRect(left, top, right - left, bottom - top, 22);

    // Centre line and the two lines of the sheet (hog line before the house, back line behind it).
    g.lineStyle(3, ICE_LINE, 0.8);
    g.lineBetween(left + 40, HOUSE_CENTER.y, right - 24, HOUSE_CENTER.y);
    g.lineStyle(8, RING_RED, 0.55);
    g.lineBetween(left + 330, top, left + 330, bottom);
    g.lineStyle(4, RING_BLUE, 0.5);
    g.lineBetween(HOUSE_CENTER.x + HOUSE_RINGS[0] + 28, top, HOUSE_CENTER.x + HOUSE_RINGS[0] + 28, bottom);

    // The house: blue, white, red, button.
    const { x, y } = HOUSE_CENTER;
    g.fillStyle(RING_BLUE, 1);
    g.fillCircle(x, y, HOUSE_RINGS[0]);
    g.lineStyle(5, RING_BLUE_EDGE, 1);
    g.strokeCircle(x, y, HOUSE_RINGS[0]);
    g.fillStyle(0xf4f7fb, 1);
    g.fillCircle(x, y, HOUSE_RINGS[1]);
    g.lineStyle(3, ICE_LINE, 1);
    g.strokeCircle(x, y, HOUSE_RINGS[1]);
    g.fillStyle(RING_RED, 1);
    g.fillCircle(x, y, HOUSE_RINGS[2]);
    g.lineStyle(4, RING_RED_EDGE, 1);
    g.strokeCircle(x, y, HOUSE_RINGS[2]);
    g.fillStyle(0xf4f7fb, 1);
    g.fillCircle(x, y, HOUSE_RINGS[3]);
    g.lineStyle(3, ICE_LINE, 1);
    g.strokeCircle(x, y, HOUSE_RINGS[3]);

    // Throwing circles.
    for (const team of ["red", "yellow"] as TeamId[]) {
      const c = CIRCLE_CENTER[team];
      g.lineStyle(5, TEAM_COLORS[team], 0.9);
      for (let i = 0; i < 20; i++) {
        const a0 = (Math.PI * 2 * i) / 20;
        g.beginPath();
        g.arc(c.x, c.y, CIRCLE_RADIUS, a0, a0 + (Math.PI * 2) / 40);
        g.strokePath();
      }
    }
  }

  private addDecor(): void {
    addAds(this.scene, [
      ["GLAÇONS & FILS", 560, 103],
      ["ANTIGEL PREMIUM", 1040, 103],
      ["BALAIS BRILLANTS", 560, GAME_HEIGHT - 103],
      ["PATINS PRO", 1040, GAME_HEIGHT - 103],
    ]);
    addSign(this.scene, 520, 40, 200, 38, -3, CREAM, [{ text: "VISE !", color: "#2456a0", size: 17 }]);
    addSign(this.scene, 1120, 40, 220, 38, 3, CREAM, [{ text: "ÇA GLISSE !", color: COLORS.ink, size: 20 }]);
  }
}
