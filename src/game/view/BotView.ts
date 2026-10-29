import Phaser from "phaser";
import { BOT_RADIUS } from "@/config/physics";
import { BOT_ART_RADIUS, BotArtState, drawBot, drawBotShadow, drawSmoke } from "@/game/view/botArt";

const ART_SCALE = BOT_RADIUS / BOT_ART_RADIUS;

/**
 * Renders one bot with Graphics. Owns no gameplay state: feed it a position, a spin and the
 * current part state. Swap this class for a sprite-based one to change the look later.
 */
export class BotView {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly smoke: Phaser.GameObjects.Graphics;
  private wreck = false;

  constructor(
    scene: Phaser.Scene,
    private readonly color: number,
  ) {
    this.shadow = scene.add.graphics().setDepth(8).setScale(ART_SCALE);
    drawBotShadow(this.shadow);
    this.body = scene.add.graphics().setDepth(10).setScale(ART_SCALE);
    this.smoke = scene.add.graphics().setDepth(11).setScale(ART_SCALE);
  }

  /** Redraws the shell and parts (call when a part falls off). */
  setParts(state: BotArtState): void {
    drawBot(this.body, this.color, state);
    this.wreck = state.isWreck;
    if (!this.wreck) this.smoke.clear();
  }

  sync(x: number, y: number, spin: number, timeSec: number): void {
    this.shadow.setPosition(x, y);
    this.body.setPosition(x, y).setRotation(spin);
    if (this.wreck) {
      this.smoke.setPosition(x, y);
      drawSmoke(this.smoke, timeSec);
    }
  }

  setVisible(visible: boolean): void {
    this.shadow.setVisible(visible);
    this.body.setVisible(visible);
    this.smoke.setVisible(visible);
  }

  destroy(): void {
    this.shadow.destroy();
    this.body.destroy();
    this.smoke.destroy();
  }
}
