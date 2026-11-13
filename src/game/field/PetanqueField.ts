import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import { COLORS } from "@/config/theme";
import {
  CIRCLE_CENTER,
  CIRCLE_RADIUS,
  JACK_MARGIN,
  JACK_MIN_X,
  PLAY_RECT,
  WOOD_RECT,
  WOOD_RESTITUTION,
} from "@/config/petanque";
import { WALL_PHYSICS } from "@/config/physics";
import { CREAM, addAds, addSign, fillRounded, paintCrowd, paintRim, strokeRounded } from "@/game/field/stadium";
import { EndResult } from "@/game/petanque";
import { Rng } from "@/game/Rng";
import { bakeTexture } from "@/game/view/bake";
import { titleText, bodyText } from "@/ui/ui";

const TEXTURE_KEY = "botz-petanque-bg";
const WALL_THICKNESS = 60;

/**
 * Pétanque court: stands, wooden border and gravel (baked once), the border's collision walls, the
 * two throwing circles with the botz still to throw, and the "On mesure !" animation.
 */
export class PetanqueField {
  private readonly remaining: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    bakeTexture(scene, TEXTURE_KEY, GAME_WIDTH, GAME_HEIGHT, (g) => this.paintBackdrop(g));
    scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0, 0).setDepth(-20);
    this.remaining = scene.add.graphics().setDepth(-9);
    this.buildWalls();
    this.addDecor();
  }

  /** Picks a spot for the jack in the right two thirds of the court, away from the borders. */
  static randomJackPosition(rng: Rng): { x: number; y: number } {
    return {
      x: rng.range(JACK_MIN_X, PLAY_RECT.right - JACK_MARGIN),
      y: rng.range(PLAY_RECT.top + JACK_MARGIN, PLAY_RECT.bottom - JACK_MARGIN),
    };
  }

  /** Little bot icons beside each circle: the botz that team still has to throw this end. */
  setRemaining(counts: Record<TeamId, number>): void {
    const g = this.remaining;
    g.clear();
    for (const team of ["red", "yellow"] as TeamId[]) {
      const c = CIRCLE_CENTER[team];
      for (let i = 0; i < counts[team]; i++) {
        const x = PLAY_RECT.left + 26;
        const y = c.y - 24 + i * 24;
        g.fillStyle(TEAM_COLORS[team], 1);
        g.fillRoundedRect(x - 12, y - 8, 24, 16, 8);
        g.fillStyle(COLORS.botVisor, 1);
        g.fillRoundedRect(x - 6, y - 3, 12, 5, 2.5);
      }
    }
  }

  /**
   * "On mesure !": dashed lines from the jack to each team's closest bot, a "le plus près" badge on the
   * winner and a ring on every bot that scores, then the verdict. Returns a function that removes it all.
   */
  showMeasure(jack: { x: number; y: number }, result: EndResult): () => void {
    const scene = this.scene;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = scene.add.graphics().setDepth(100);
    objects.push(g);

    const dashed = (x0: number, y0: number, x1: number, y1: number, color: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ux = (x1 - x0) / len;
      const uy = (y1 - y0) / len;
      g.lineStyle(4, color, 1);
      for (let d = 0; d < len; d += 22) {
        const e = Math.min(d + 12, len);
        g.lineBetween(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e);
      }
    };

    const closest = new Map<TeamId, (typeof result.ranked)[number]>();
    for (const r of result.ranked) if (!closest.has(r.bot.team)) closest.set(r.bot.team, r);
    for (const [team, r] of closest) dashed(jack.x, jack.y, r.bot.x, r.bot.y, TEAM_COLORS[team]);

    for (const r of result.ranked) {
      if (!result.scoringUids.includes(r.bot.uid)) continue;
      g.lineStyle(5, 0xffffff, 1);
      g.strokeCircle(r.bot.x, r.bot.y, 46);
    }

    const lead = result.ranked[0];
    if (lead && result.winner) {
      const badge = scene.add.container(lead.bot.x, lead.bot.y + 66).setDepth(101);
      const text = scene.add.text(0, 0, "le plus près", bodyText(24, "#ffffff", "700")).setOrigin(0.5);
      const bg = scene.add.graphics();
      bg.fillStyle(0x0e1428, 1);
      bg.fillRoundedRect(-text.width / 2 - 18, -22, text.width + 36, 44, 22);
      badge.add([bg, text]);
      objects.push(badge);
    }

    const title = scene.add.text(GAME_WIDTH / 2, 150, "ON MESURE !", titleText(40, "#ffffff")).setOrigin(0.5).setDepth(101).setStroke("#141b31", 8);
    objects.push(title);
    scene.time.delayedCall(1400, () => {
      if (!title.active) return;
      if (result.winner) {
        const label = result.winner === "red" ? "ROUGE" : "JAUNE";
        title.setText(`${label} MARQUE ${result.points} POINT${result.points > 1 ? "S" : ""} !`).setColor(result.winner === "red" ? "#ff8a84" : "#f6c234");
      } else {
        title.setText("ÉGALITÉ : ON REJOUE !");
      }
    });

    return () => {
      for (const o of objects) o.destroy();
    };
  }

  // ───────────────────────────── collision ─────────────────────────────

  private buildWalls(): void {
    const { left, right, top, bottom } = PLAY_RECT;
    const t = WALL_THICKNESS;
    const w = right - left;
    const h = bottom - top;
    const wall = (cx: number, cy: number, width: number, height: number) =>
      this.scene.matter.add.rectangle(cx, cy, width, height, {
        isStatic: true,
        restitution: WOOD_RESTITUTION,
        friction: WALL_PHYSICS.friction,
        label: "wall",
      });
    wall(left + w / 2, top - t / 2, w + 2 * t, t);
    wall(left + w / 2, bottom + t / 2, w + 2 * t, t);
    wall(left - t / 2, top + h / 2, t, h);
    wall(right + t / 2, top + h / 2, t, h);
  }

  // ───────────────────────────── rendering ─────────────────────────────

  private paintBackdrop(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.night, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    paintCrowd(g);
    paintRim(g);

    // Wooden border, then gravel.
    g.fillStyle(COLORS.woodDark, 1);
    g.fillRoundedRect(WOOD_RECT.left - 4, WOOD_RECT.top - 4, WOOD_RECT.right - WOOD_RECT.left + 8, WOOD_RECT.bottom - WOOD_RECT.top + 8, WOOD_RECT.radius + 4);
    g.fillStyle(COLORS.wood, 1);
    fillRounded(g, WOOD_RECT);
    g.lineStyle(3, COLORS.woodDark, 1);
    strokeRounded(g, WOOD_RECT);

    g.fillStyle(COLORS.gravel, 1);
    g.fillRoundedRect(PLAY_RECT.left, PLAY_RECT.top, PLAY_RECT.right - PLAY_RECT.left, PLAY_RECT.bottom - PLAY_RECT.top, 22);
    g.lineStyle(3, COLORS.woodDark, 0.7);
    g.strokeRoundedRect(PLAY_RECT.left, PLAY_RECT.top, PLAY_RECT.right - PLAY_RECT.left, PLAY_RECT.bottom - PLAY_RECT.top, 22);

    // Pebbles (cosmetic: a fixed seed keeps the court identical every time).
    const rng = new Rng(0x9e77);
    g.fillStyle(COLORS.gravelPebble, 1);
    for (let i = 0; i < 520; i++) {
      const x = rng.range(PLAY_RECT.left + 14, PLAY_RECT.right - 14);
      const y = rng.range(PLAY_RECT.top + 14, PLAY_RECT.bottom - 14);
      g.fillCircle(x, y, rng.range(1.5, 3.6));
    }

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
      ["BOULONS & FILS", 560, 103],
      ["GRAVIER PREMIUM", 1040, 103],
      ["BOULES TACHÉES", 560, GAME_HEIGHT - 103],
      ["MÈTRE RUBAN PRO", 1040, GAME_HEIGHT - 103],
    ]);
    addSign(this.scene, 520, 40, 190, 38, -3, CREAM, [{ text: "TU TIRES ?", color: "#d63a33", size: 20 }]);
    addSign(this.scene, 1120, 40, 210, 38, 3, CREAM, [{ text: "ON MESURE !", color: COLORS.ink, size: 18 }]);
  }
}
