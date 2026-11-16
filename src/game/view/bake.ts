import Phaser from "phaser";
import { GAME_HEIGHT } from "@/config/game";
import { WORLD_LEFT, WORLD_WIDTH } from "@/config/viewport";

/**
 * Paints a full-screen backdrop once into a texture, so big backgrounds cost one image draw per
 * frame instead of re-running thousands of Graphics commands, then shows it behind everything.
 * `paint` draws in design coordinates; the texture also covers the side margins of wide screens
 * (see config/viewport.ts). A texture that already exists (scene restart) is reused.
 */
export function addBackdrop(
  scene: Phaser.Scene,
  key: string,
  paint: (g: Phaser.GameObjects.Graphics) => void,
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-WORLD_LEFT, 0);
    paint(g);
    g.generateTexture(key, WORLD_WIDTH, GAME_HEIGHT);
    g.destroy();
  }
  return scene.add.image(WORLD_LEFT, 0, key).setOrigin(0, 0).setDepth(-20);
}
