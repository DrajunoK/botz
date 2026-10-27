import Phaser from "phaser";

/** Lightens (positive amount) or darkens (negative) a 0xRRGGBB color by a fixed channel offset. */
export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  const adjust = (v: number) => Phaser.Math.Clamp(Math.round(v + amount), 0, 255);
  return Phaser.Display.Color.GetColor(adjust(c.red), adjust(c.green), adjust(c.blue));
}
