import Phaser from "phaser";
import { SceneKeys } from "./keys";

/**
 * No external assets to load in V1 (everything is drawn with Graphics), so
 * this scene just exists as the conventional entry point for future asset
 * preloading (sprites, sounds, fonts) without touching MenuScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.Menu);
  }
}
