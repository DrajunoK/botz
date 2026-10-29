import Phaser from "phaser";
import { COLORS } from "@/config/theme";

const SPECTATOR_COLORS = {
  red: COLORS.red,
  yellow: COLORS.yellow,
  gray: 0x8fa0c4,
  teal: 0x5fc2a8,
};

/** Spectator positions inside one 72×40 tile of the mockups' crowd pattern. */
export const CROWD_TILE: readonly [number, number, number][] = [
  [12, 12, SPECTATOR_COLORS.red],
  [36, 12, SPECTATOR_COLORS.yellow],
  [60, 12, SPECTATOR_COLORS.gray],
  [0, 32, SPECTATOR_COLORS.yellow],
  [24, 32, SPECTATOR_COLORS.teal],
  [48, 32, SPECTATOR_COLORS.red],
  [72, 32, SPECTATOR_COLORS.yellow],
];

export const CROWD_TILE_W = 72;
export const CROWD_TILE_H = 40;

/** One tiny robot spectator: round head, dark visor, two LED eyes. `s` scales the 9-px-radius original. */
export function paintSpectator(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(x, y, 9 * s);
  g.fillStyle(COLORS.botVisor, 1);
  g.fillRoundedRect(x - 6 * s, y - 3 * s, 12 * s, 6 * s, 3 * s);
  g.fillStyle(COLORS.botEye, 1);
  g.fillCircle(x - 2.5 * s, y, 1.4 * s);
  g.fillCircle(x + 2.5 * s, y, 1.4 * s);
}
