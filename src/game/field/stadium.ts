import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { COLORS, FONTS } from "@/config/theme";
import { RoundedRect, wallInfo } from "@/game/field/fieldGeometry";
import { CROWD_TILE, CROWD_TILE_H, CROWD_TILE_W, paintSpectator } from "@/game/view/crowd";

/** What every game shares: the stands full of robot spectators, the rim around the play area, ads and signs. */

/** Workshop-bench rim around the play area (holds the goal nets and the ads). */
export const RIM_RECT: RoundedRect = { left: 86, right: GAME_WIDTH - 86, top: 76, bottom: GAME_HEIGHT - 76, radius: 250 };
/** Outer edge of the stands. */
export const CROWD_RECT: RoundedRect = { left: 6, right: GAME_WIDTH - 6, top: 6, bottom: GAME_HEIGHT - 6, radius: 300 };

export const CREAM = 0xfff7ea;
const CROWD_SCALE = 1.45;

export function fillRounded(g: Phaser.GameObjects.Graphics, r: RoundedRect): void {
  g.fillRoundedRect(r.left, r.top, r.right - r.left, r.bottom - r.top, r.radius);
}

export function strokeRounded(g: Phaser.GameObjects.Graphics, r: RoundedRect): void {
  g.strokeRoundedRect(r.left, r.top, r.right - r.left, r.bottom - r.top, r.radius);
}

/** Stands full of tiny robot spectators in team colors, tiled like the mockup's crowd pattern. */
export function paintCrowd(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.crowdBase, 1);
  fillRounded(g, CROWD_RECT);
  g.lineStyle(4, COLORS.outline, 1);
  strokeRounded(g, CROWD_RECT);

  const s = CROWD_SCALE;
  const r = 9 * s;
  for (let ty = -CROWD_TILE_H * s; ty < GAME_HEIGHT + CROWD_TILE_H * s; ty += CROWD_TILE_H * s) {
    for (let tx = -CROWD_TILE_W * s; tx < GAME_WIDTH + CROWD_TILE_W * s; tx += CROWD_TILE_W * s) {
      for (const [px, py, color] of CROWD_TILE) {
        const x = tx + px * s;
        const y = ty + py * s;
        if (wallInfo(CROWD_RECT, x, y).distance < r + 4) continue; // outside the stands
        if (wallInfo(RIM_RECT, x, y).distance > -r) continue; // would sit on the rim
        paintSpectator(g, x, y, s, color);
      }
    }
  }
}

export function paintRim(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.rim, 1);
  fillRounded(g, RIM_RECT);
  g.lineStyle(3, COLORS.outline, 1);
  strokeRounded(g, RIM_RECT);
}

/** Faint advertising text on the rim: `[label, x, y]`. */
export function addAds(scene: Phaser.Scene, ads: readonly [string, number, number][]): void {
  const style = { fontFamily: FONTS.title, fontSize: "18px", color: COLORS.textFaint };
  for (const [label, x, y] of ads) scene.add.text(x, y, label, style).setOrigin(0.5).setDepth(-19);
}

/** A tilted sign stuck on the stands. */
export function addSign(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  angleDeg: number,
  fill: number,
  lines: { text: string; color: string; size: number }[],
): void {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  g.lineStyle(3, COLORS.outline, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  const gap = h / (lines.length + 1);
  const texts = lines.map((l, i) =>
    scene.add.text(0, -h / 2 + gap * (i + 1), l.text, { fontFamily: FONTS.title, fontSize: `${l.size}px`, color: l.color }).setOrigin(0.5),
  );
  scene.add.container(x, y, [g, ...texts]).setAngle(angleDeg).setDepth(-18);
}
