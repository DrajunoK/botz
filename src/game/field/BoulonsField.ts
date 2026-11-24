import Phaser from "phaser";
import { GAME_HEIGHT, TEAM_COLORS, TeamId } from "@/config/game";
import { ARENA, WALL_RESTITUTION, ZONE } from "@/config/boulons";
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
      const z = ZONE[team];
      const color = TEAM_COLORS[team];
      g.fillStyle(color, 0.28);
      g.fillRoundedRect(z.left, z.top, z.right - z.left, z.bottom - z.top, 26);
      g.lineStyle(6, color, 1);
      const w = z.right - z.left;
      const h = z.bottom - z.top;
      // Dashed outline (the side along the wall is left open).
      const edge = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        const ux = (x1 - x0) / len;
        const uy = (y1 - y0) / len;
        for (let d = 0; d < len; d += 30) {
          const e = Math.min(d + 18, len);
          g.lineBetween(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e);
        }
      };
      if (team === "red") {
        edge(z.left, z.top, z.right, z.top);
        edge(z.right, z.top, z.right, z.bottom);
        edge(z.right, z.bottom, z.left, z.bottom);
      } else {
        edge(z.right, z.top, z.left, z.top);
        edge(z.left, z.top, z.left, z.bottom);
        edge(z.left, z.bottom, z.right, z.bottom);
      }
      // A funnel arrow pointing at the wall.
      const dir = team === "red" ? -1 : 1;
      const cx = z.left + w / 2;
      const cy = z.top + h / 2;
      g.fillStyle(color, 0.7);
      g.fillTriangle(cx + dir * 36, cy, cx - dir * 24, cy - 40, cx - dir * 24, cy + 40);
    }
  }

  private addDecor(): void {
    for (const team of ["red", "yellow"] as TeamId[]) {
      const z = ZONE[team];
      this.scene.add
        .text((z.left + z.right) / 2, z.top - 28, "DÉPÔT", { fontFamily: "Bungee", fontSize: "26px", color: team === "red" ? "#a52e29" : "#8a6411" })
        .setOrigin(0.5)
        .setDepth(-9);
    }
    addAds(this.scene, [["BOULONS & FILS", 560, GAME_HEIGHT - 20]]);
    addSign(this.scene, 800, 112, 240, 34, -2, CREAM, [{ text: "RAMASSE TOUT !", color: "#d63a33", size: 20 }]);
  }
}
