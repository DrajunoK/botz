import Phaser from "phaser";
import { createButton } from "@/ui/Button";
import { fullscreenAvailable, isFullscreen, toggleFullscreen } from "@/ui/fullscreen";

const ICON_COLOR = 0xe9edf7;

/** Four corner brackets pointing outwards (enter fullscreen) or inwards (leave it). */
function drawIcon(g: Phaser.GameObjects.Graphics, size: number, fullscreen: boolean): void {
  const reach = size * (fullscreen ? 0.12 : 0.28);
  const arm = size * 0.2;
  g.clear();
  g.lineStyle(5, ICON_COLOR, 1);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const inner = fullscreen ? reach + arm : reach - arm;
      g.beginPath();
      g.moveTo(sx * reach, sy * inner);
      g.lineTo(sx * reach, sy * reach);
      g.lineTo(sx * inner, sy * reach);
      g.strokePath();
    }
  }
}

/**
 * Fullscreen toggle (ghost icon button). Returns undefined where fullscreen is unavailable
 * (installed PWA, iPhone Safari), so callers just skip it.
 */
export function createFullscreenButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Container | undefined {
  if (!fullscreenAvailable()) return undefined;

  const button = createButton(scene, x, y, "", () => void toggleFullscreen(), { width: size, height: size, variant: "ghost" });
  const icon = scene.add.graphics();
  (button.list[1] as Phaser.GameObjects.Container).add(icon);

  const redraw = (): void => drawIcon(icon, size, isFullscreen());
  redraw();
  document.addEventListener("fullscreenchange", redraw);
  button.once(Phaser.GameObjects.Events.DESTROY, () => document.removeEventListener("fullscreenchange", redraw));
  return button;
}
