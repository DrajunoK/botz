import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { gameWidthForAspect } from "@/config/viewport";

/** Resizes the canvas' logical width to the screen's aspect ratio (the height stays GAME_HEIGHT). */
export function fitGameWidthToScreen(game: Phaser.Game): void {
  const { clientWidth, clientHeight } = game.scale.parent;
  if (clientHeight > 0) {
    const width = gameWidthForAspect(clientWidth / clientHeight);
    if (width !== game.scale.gameSize.width) game.scale.setGameSize(width, GAME_HEIGHT);
  }
  game.scale.refresh();
}

/**
 * Keeps the design area centred on screen. Scenes lay out in design coordinates
 * (0..GAME_WIDTH); extra width on wide screens shows up on both sides.
 */
export function centerOnDesignArea(scene: Phaser.Scene): void {
  const center = (): void => {
    scene.cameras.main.setScroll((GAME_WIDTH - scene.scale.width) / 2, 0);
  };
  center();
  scene.scale.on(Phaser.Scale.Events.RESIZE, center);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, center));
}
