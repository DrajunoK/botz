import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { COLORS } from "@/config/theme";
import { PLATFORM_CENTER, PLATFORM_RADIUS, SHRINK_ANIM_MS } from "@/config/survivor";
import { RoundedRect } from "@/game/field/fieldGeometry";
import { Disc } from "@/game/field/survivorGeometry";
import { CREAM, addAds, addSign, fillRounded, paintCrowd, paintRim, strokeRounded } from "@/game/field/stadium";
import { bakeTexture } from "@/game/view/bake";

/** The lake of lava the catwalk floats on. */
const LAVA_RECT: RoundedRect = { left: 120, right: GAME_WIDTH - 120, top: 100, bottom: GAME_HEIGHT - 100, radius: 330 };
const LAVA_TEXTURE_KEY = "botz-lava-bg";

const RIVETS = 14;
const EDGE_DASHES = 56;

/**
 * Survivant arena: stands + rim + lava lake (baked once), and the round metal catwalk, redrawn
 * whenever its radius changes. Pure rendering: the radius itself is owned by SurvivorMode.
 */
export class LavaPlatform {
  private readonly g: Phaser.GameObjects.Graphics;
  private radius = PLATFORM_RADIUS;
  private shrinkTween?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene) {
    bakeTexture(scene, LAVA_TEXTURE_KEY, GAME_WIDTH, GAME_HEIGHT, (g) => this.paintBackdrop(g));
    scene.add.image(0, 0, LAVA_TEXTURE_KEY).setOrigin(0, 0).setDepth(-20);
    this.addDecor();
    this.addBubbles();
    this.g = scene.add.graphics().setDepth(-10);
    this.draw();
  }

  get disc(): Disc {
    return { ...PLATFORM_CENTER, radius: this.radius };
  }

  /** Sets the radius, animating the shrink unless `animate` is false. */
  setRadius(radius: number, animate = true): void {
    this.shrinkTween?.stop();
    if (!animate) {
      this.radius = radius;
      this.draw();
      return;
    }
    const state = { r: this.radius };
    this.shrinkTween = this.scene.tweens.add({
      targets: state,
      r: radius,
      duration: SHRINK_ANIM_MS,
      ease: "Quad.InOut",
      onUpdate: () => {
        this.radius = state.r;
        this.draw();
      },
      onComplete: () => {
        this.radius = radius;
        this.draw();
      },
    });
  }

  private paintBackdrop(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.night, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    paintCrowd(g);
    paintRim(g);

    // Lava lake with a dark crust around it.
    g.fillStyle(COLORS.lavaDark, 1);
    g.fillRoundedRect(LAVA_RECT.left - 12, LAVA_RECT.top - 12, LAVA_RECT.right - LAVA_RECT.left + 24, LAVA_RECT.bottom - LAVA_RECT.top + 24, LAVA_RECT.radius + 12);
    g.fillStyle(COLORS.lava, 1);
    fillRounded(g, LAVA_RECT);
    g.lineStyle(4, COLORS.lavaDark, 1);
    strokeRounded(g, LAVA_RECT);

    // Lighter pools and darker crust patches.
    const pools: [number, number, number, number, number][] = [
      [290, 240, 130, 44, COLORS.lavaLight],
      [1310, 240, 130, 42, COLORS.lavaLight],
      [1300, 640, 130, 40, COLORS.lavaLight],
      [300, 650, 140, 46, COLORS.lavaLight],
      [250, 440, 60, 20, COLORS.lavaDark],
      [1360, 450, 66, 22, COLORS.lavaDark],
      [560, 175, 80, 18, COLORS.lavaDark],
    ];
    for (const [x, y, rx, ry, color] of pools) {
      g.fillStyle(color, color === COLORS.lavaDark ? 0.45 : 0.7);
      g.fillEllipse(x, y, rx * 2, ry * 2);
    }
  }

  private addDecor(): void {
    addAds(this.scene, [
      ["SOUDURE RAPIDE", 560, 103],
      ["HUILE EXTRA-FINE", 1040, 103],
      ["ANTI-ROUILLE", 1040, GAME_HEIGHT - 103],
    ]);
    addSign(this.scene, 520, 40, 180, 38, -3, CREAM, [{ text: "POUSSE !", color: "#d63a33", size: 20 }]);
    addSign(this.scene, 1120, 40, 210, 38, 3, CREAM, [{ text: "ÇA CHAUFFE", color: COLORS.ink as string, size: 18 }]);
  }

  /** Slow bubbles rising and popping on the lava, outside the catwalk. */
  private addBubbles(): void {
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(LAVA_RECT.left + 60, LAVA_RECT.right - 60);
      const y = Phaser.Math.Between(LAVA_RECT.top + 50, LAVA_RECT.bottom - 50);
      if (Math.hypot(x - PLATFORM_CENTER.x, y - PLATFORM_CENTER.y) < PLATFORM_RADIUS + 20) continue;
      const bubble = this.scene.add.graphics().setDepth(-15).setPosition(x, y).setAlpha(0);
      bubble.fillStyle(COLORS.lavaGlow, 1);
      bubble.fillCircle(0, 0, Phaser.Math.Between(6, 12));
      this.scene.tweens.add({
        targets: bubble,
        alpha: { from: 0, to: 0.9 },
        scale: { from: 0.3, to: 1.2 },
        duration: Phaser.Math.Between(900, 1600),
        delay: Phaser.Math.Between(0, 2500),
        repeat: -1,
        repeatDelay: Phaser.Math.Between(600, 2200),
        ease: "Sine.Out",
      });
    }
  }

  private draw(): void {
    const g = this.g;
    const { x: cx, y: cy } = PLATFORM_CENTER;
    const r = this.radius;
    g.clear();

    // Heat glow, then the rim of the catwalk.
    g.fillStyle(COLORS.lavaGlow, 0.45);
    g.fillCircle(cx, cy, r + 16);
    g.fillStyle(COLORS.catwalkEdge, 1);
    g.fillCircle(cx, cy, r);

    // Red / white warning dashes along the edge.
    const dashRadius = r - 7;
    for (let i = 0; i < EDGE_DASHES; i++) {
      const a0 = (Math.PI * 2 * i) / EDGE_DASHES;
      g.lineStyle(7, i % 2 === 0 ? COLORS.red : 0xf4f7fb, 1);
      g.beginPath();
      g.arc(cx, cy, dashRadius, a0, a0 + (Math.PI * 2) / EDGE_DASHES);
      g.strokePath();
    }

    g.fillStyle(COLORS.catwalkRing, 1);
    g.fillCircle(cx, cy, r - 18);
    const plate = r - 34;
    g.fillStyle(COLORS.catwalkPlate, 1);
    g.fillCircle(cx, cy, plate);

    // Grid on the plate, each line clipped to the circle.
    g.lineStyle(2, COLORS.catwalkGrid, 1);
    for (let d = -plate + 40; d < plate; d += 40) {
      const h = Math.sqrt(Math.max(0, plate * plate - d * d));
      g.lineBetween(cx + d, cy - h, cx + d, cy + h);
      g.lineBetween(cx - h, cy + d, cx + h, cy + d);
    }

    // Rivets on the ring.
    g.fillStyle(COLORS.catwalkEdge, 1);
    for (let i = 0; i < RIVETS; i++) {
      const a = (Math.PI * 2 * i) / RIVETS;
      g.fillCircle(cx + Math.cos(a) * (r - 26), cy + Math.sin(a) * (r - 26), Math.max(2, r * 0.012));
    }

    // Centre emblem: a faint circle with a lightning bolt.
    const k = Math.min(1, r / PLATFORM_RADIUS);
    g.lineStyle(5 * k, COLORS.catwalkGrid, 0.8);
    g.strokeCircle(cx, cy, 44 * k);
    g.fillStyle(COLORS.catwalkGrid, 0.8);
    g.fillPoints(
      [
        [4, -26], [-14, 4], [-2, 4], [-6, 26], [14, -6], [2, -6],
      ].map(([px, py]) => new Phaser.Math.Vector2(cx + px * k, cy + py * k)),
      true,
    );
  }
}
