import Phaser from "phaser";
import { COLORS, FONTS } from "@/config/theme";

/** Shared styling helpers so every screen speaks the same visual language. */

export const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export function bodyText(size: number, color: string = COLORS.textMain, weight = "600"): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONTS.body, fontSize: `${size}px`, color, fontStyle: weight };
}

export function titleText(size: number, color: string = "#ffffff"): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONTS.title, fontSize: `${size}px`, color };
}

/** Dark rounded "pill" panel with the thin blue-gray border used all over the HUD. */
export function drawPill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius = h / 2, fill: number = COLORS.panel): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, COLORS.panelBorder, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}
