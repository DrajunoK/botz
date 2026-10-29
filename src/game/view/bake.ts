import Phaser from "phaser";

/**
 * Paints static artwork once into a texture, so big backgrounds cost one image draw per
 * frame instead of re-running thousands of Graphics commands. A texture that already
 * exists (scene restart) is reused.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(g);
  g.generateTexture(key, width, height);
  g.destroy();
}
