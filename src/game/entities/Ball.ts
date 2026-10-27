import Phaser from "phaser";
import { BALL_RADIUS, BALL_PHYSICS } from "@/config/physics";

/**
 * The ball. Physics body driven by Matter; visuals drawn with Graphics.
 */
export class Ball {
  readonly gameObject: Phaser.Physics.Matter.Sprite;
  private graphics: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.matter.add.sprite(x, y, "");
    // No texture is loaded (V1 draws everything with Graphics, see redraw()),
    // so hide Phaser's fallback "missing texture" checkerboard — the sprite
    // still exists purely as the Matter physics body.
    this.gameObject.setVisible(false);
    this.gameObject.setCircle(BALL_RADIUS, {
      restitution: BALL_PHYSICS.restitution,
      friction: BALL_PHYSICS.friction,
      frictionAir: BALL_PHYSICS.frictionAir,
      density: BALL_PHYSICS.density,
      label: "ball",
    });

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

  get speed(): number {
    const v = this.body.velocity;
    return Math.hypot(v.x, v.y);
  }

  setPosition(x: number, y: number): void {
    this.gameObject.setPosition(x, y);
    this.gameObject.setVelocity(0, 0);
    this.gameObject.setAngularVelocity(0);
  }

  syncVisuals(): void {
    const x = this.gameObject.x;
    const y = this.gameObject.y;
    this.shadow.clear();
    this.shadow.setPosition(x, y);
    this.shadow.fillStyle(0x000000, 0.3);
    this.shadow.fillEllipse(3, 6, BALL_RADIUS * 1.7, BALL_RADIUS * 0.9);

    this.graphics.setPosition(x, y);
    this.graphics.setRotation(this.gameObject.rotation);
  }

  private pentagonPoints(radius: number): Phaser.Math.Vector2[] {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 5; i++) {
      const a = Phaser.Math.DegToRad(-90 + i * 72);
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * radius, Math.sin(a) * radius));
    }
    return pts;
  }

  private redraw(): void {
    const g = this.graphics;
    const pink = 0xec4899;
    g.clear();

    // Soft glow rim.
    g.fillStyle(pink, 0.18);
    g.fillCircle(0, 0, BALL_RADIUS * 1.35);

    // Glossy gradient body.
    g.fillGradientStyle(0xffffff, 0xffffff, 0xd7dde6, 0xd7dde6, 1, 1, 1, 1);
    g.fillCircle(0, 0, BALL_RADIUS);
    g.lineStyle(2.5, pink, 0.85);
    g.strokeCircle(0, 0, BALL_RADIUS);

    // Specular highlight.
    g.fillStyle(0xffffff, 0.95);
    g.fillEllipse(-BALL_RADIUS * 0.32, -BALL_RADIUS * 0.36, BALL_RADIUS * 0.5, BALL_RADIUS * 0.32);

    // Center pentagon + accent dots (soccer-ball motif, in the team-neutral pink).
    g.fillStyle(pink, 0.92);
    g.fillPoints(this.pentagonPoints(BALL_RADIUS * 0.34), true);
    g.fillStyle(pink, 0.55);
    g.fillCircle(BALL_RADIUS * 0.5, BALL_RADIUS * 0.35, BALL_RADIUS * 0.14);
    g.fillCircle(-BALL_RADIUS * 0.5, BALL_RADIUS * 0.28, BALL_RADIUS * 0.14);
  }

  destroy(): void {
    this.gameObject.destroy();
    this.graphics.destroy();
    this.shadow.destroy();
  }
}
