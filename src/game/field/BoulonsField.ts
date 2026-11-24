import Phaser from "phaser";
import { GAME_HEIGHT, TEAM_COLORS, TeamId } from "@/config/game";
import { ARENA, PIT, WALL_RESTITUTION } from "@/config/boulons";
import { COLORS } from "@/config/theme";
import { WALL_PHYSICS } from "@/config/physics";
import { CREAM, addAds, addSign } from "@/game/field/stadium";
import { Rng } from "@/game/Rng";
import { addBackdrop } from "@/game/view/bake";
import { WORLD_LEFT, WORLD_WIDTH } from "@/config/viewport";

const TEXTURE_KEY = "botz-boulons-bg";
const WALL_THICKNESS = 60;
const HAZARD = 20;

/** Workshop floor: steel plates with a hazard-striped edge, and one deposit zone per team. */
export class BoulonsField {
  constructor(private readonly scene: Phaser.Scene) {
    addBackdrop(scene, TEXTURE_KEY, (g) => this.paintBackdrop(g));
    this.buildWalls();
    this.addDecor();
  }

  private buildWalls(): void {
    const { left, right, top, bottom } = ARENA;
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
  }

  private paintBackdrop(g: Phaser.GameObjects.Graphics): void {
    const { left, right, top, bottom } = ARENA;
    g.fillStyle(COLORS.night, 1);
    g.fillRect(WORLD_LEFT, 0, WORLD_WIDTH, GAME_HEIGHT);

    // Hazard-striped frame: yellow and black diagonals.
    g.fillStyle(0x1b1f2e, 1);
    g.fillRoundedRect(left - HAZARD - 6, top - HAZARD - 6, right - left + 2 * HAZARD + 12, bottom - top + 2 * HAZARD + 12, 30);
    g.fillStyle(0xf6c234, 1);
    g.fillRoundedRect(left - HAZARD, top - HAZARD, right - left + 2 * HAZARD, bottom - top + 2 * HAZARD, 26);
    g.fillStyle(0x1b1f2e, 1);
    for (let x = left - HAZARD - 40; x < right + HAZARD; x += 56) {
      g.fillTriangle(x, top - HAZARD, x + 28, top - HAZARD, x + 8, top);
      g.fillTriangle(x, bottom, x + 28, bottom, x + 8, bottom + HAZARD);
    }
    for (let y = top - HAZARD; y < bottom + HAZARD; y += 56) {
      g.fillTriangle(left - HAZARD, y, left - HAZARD, y + 28, left, y + 8);
      g.fillTriangle(right, y, right, y + 28, right + HAZARD, y + 8);
    }

    // Steel floor plates with rivets.
    g.fillStyle(0xaab3c8, 1);
    g.fillRoundedRect(left, top, right - left, bottom - top, 14);
    const plate = 100;
    g.lineStyle(2, 0x8d97b0, 1);
    for (let x = left; x <= right; x += plate) g.lineBetween(x, top, x, bottom);
    for (let y = top; y <= bottom; y += plate) g.lineBetween(left, y, right, y);
    g.fillStyle(0x7b8499, 1);
    for (let x = left + 12; x < right; x += plate) for (let y = top + 12; y < bottom; y += plate) {
      g.fillCircle(x, y, 2.4);
      g.fillCircle(x + plate - 24, y, 2.4);
      g.fillCircle(x, y + plate - 24, 2.4);
      g.fillCircle(x + plate - 24, y + plate - 24, 2.4);
    }
    const rng = new Rng(0x501d);
    g.lineStyle(2, 0xffffff, 0.35);
    for (let i = 0; i < 40; i++) {
      const x = rng.range(left + 20, right - 80);
      const y = rng.range(top + 20, bottom - 20);
      g.lineBetween(x, y, x + rng.range(20, 70), y + rng.range(-4, 4));
    }
    // Centre mark where the golden bolt lands.
    g.lineStyle(4, 0xf6c234, 0.7);
    g.strokeCircle((left + right) / 2, (top + bottom) / 2, 54);
    g.lineStyle(2, 0xf6c234, 0.5);
    g.strokeCircle((left + right) / 2, (top + bottom) / 2, 40);

    for (const team of ["red", "yellow"] as TeamId[]) {
      const { x, y, r } = PIT[team];
      const color = TEAM_COLORS[team];
      // Steel lip, team-coloured ring, then the hole going down.
      g.fillStyle(0x4a5370, 1);
      g.fillCircle(x, y, r + 20);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r + 11);
      g.fillStyle(0x2b2233, 1);
      g.fillCircle(x, y, r + 3);
      g.fillStyle(0x1b2036, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0x12172b, 1);
      g.fillCircle(x + 3, y + 5, r * 0.86);
      g.fillStyle(0x0b0f20, 1);
      g.fillCircle(x + 6, y + 10, r * 0.66);
      g.fillStyle(0x060812, 1);
      g.fillCircle(x + 8, y + 14, r * 0.42);
      // Light catching the upper lip.
      g.lineStyle(5, 0xffffff, 0.22);
      g.beginPath();
      g.arc(x, y, r - 2, Math.PI * 1.05, Math.PI * 1.55);
      g.strokePath();
    }
  }

  private addDecor(): void {
    for (const team of ["red", "yellow"] as TeamId[]) {
      const p = PIT[team];
      this.scene.add
        .text(p.x, p.y + p.r + 44, "FOSSE", { fontFamily: "Bungee", fontSize: "24px", color: team === "red" ? "#a52e29" : "#8a6411" })
        .setOrigin(0.5)
        .setDepth(-9);
    }
    addAds(this.scene, [["BOULONS & FILS", 560, GAME_HEIGHT - 20]]);
    addSign(this.scene, 800, 112, 240, 34, -2, CREAM, [{ text: "RAMASSE TOUT !", color: "#d63a33", size: 20 }]);
  }
}
