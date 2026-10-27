import Phaser from "phaser";
import { TeamId, TEAM_COLORS } from "@/config/game";
import { BOT_RADIUS, BOT_PHYSICS } from "@/config/physics";
import { drawBotIcon, roleForIndex } from "@/game/entities/botArt";

let nextBotUid = 1;

/**
 * A round robot ("bot"). Physics body driven by Matter; visuals drawn with
 * Graphics so the look can later be swapped for sprites without touching
 * gameplay code (see `redraw`).
 */
export class Bot {
  readonly uid: number;
  readonly team: TeamId;
  readonly index: number;
  readonly gameObject: Phaser.Physics.Matter.Sprite;
  private graphics: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;
  /** Whether this bot currently has an aim arrow assigned for the upcoming resolution. */
  hasAim = false;

  constructor(scene: Phaser.Scene, team: TeamId, index: number, x: number, y: number) {
    this.uid = nextBotUid++;
    this.team = team;
    this.index = index;

    this.gameObject = scene.matter.add.sprite(x, y, "");
    // No texture is loaded (V1 draws everything with Graphics, see redraw()),
    // so hide Phaser's fallback "missing texture" checkerboard — the sprite
    // still exists purely as the Matter physics body.
    this.gameObject.setVisible(false);
    this.gameObject.setCircle(BOT_RADIUS, {
      restitution: BOT_PHYSICS.restitution,
      friction: BOT_PHYSICS.friction,
      frictionAir: BOT_PHYSICS.frictionAir,
      density: BOT_PHYSICS.density,
      label: `bot-${team}-${index}`,
    });
    this.gameObject.setFixedRotation();

    this.shadow = scene.add.graphics();
    this.graphics = scene.add.graphics();
    this.redraw();
  }

  get body(): MatterJS.BodyType {
    return this.gameObject.body as MatterJS.BodyType;
  }

  get position(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.gameObject.x, this.gameObject.y);
  }

  get velocity(): { x: number; y: number } {
    const v = this.body.velocity;
    return { x: v.x, y: v.y };
  }

  get speed(): number {
    const v = this.velocity;
    return Math.hypot(v.x, v.y);
  }

  applyShotVelocity(vx: number, vy: number): void {
    this.gameObject.setVelocity(vx, vy);
  }

  /** Re-renders the bot body at its current physics position. Call every frame. */
  syncVisuals(): void {
    const x = this.gameObject.x;
    const y = this.gameObject.y;

    this.shadow.clear();
    this.shadow.setPosition(x, y);
    this.shadow.fillStyle(0x000000, 0.3);
    this.shadow.fillEllipse(5, 10, BOT_RADIUS * 1.8, BOT_RADIUS * 0.95);
    this.shadow.fillStyle(0x000000, 0.15);
    this.shadow.fillEllipse(5, 10, BOT_RADIUS * 2.2, BOT_RADIUS * 1.2);

    this.graphics.setPosition(x, y);
  }

  private redraw(): void {
    const facing = this.team === "red" ? 1 : -1;
    drawBotIcon(this.graphics, TEAM_COLORS[this.team], BOT_RADIUS, facing, roleForIndex(this.index));
  }

  destroy(): void {
    this.gameObject.destroy();
    this.graphics.destroy();
    this.shadow.destroy();
  }
}
