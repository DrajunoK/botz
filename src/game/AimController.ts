import Phaser from "phaser";
import { Bot } from "@/game/entities/Bot";
import { TurnManager } from "@/game/TurnManager";
import { computeAim } from "@/game/aiming";
import { BOT_RADIUS, MAX_AIM_DISTANCE } from "@/config/physics";
import { TEAM_COLORS } from "@/config/game";
import { shade } from "@/game/util/color";

const HIT_RADIUS = BOT_RADIUS * 1.4;

interface ArrowVisual {
  arrow: Phaser.GameObjects.Graphics;
  range: Phaser.GameObjects.Graphics;
}

/**
 * Handles touch/pointer input for one team's bots during the aiming phase:
 * drag from a bot to draw a power/direction arrow, tap an armed bot to clear it.
 */
export class AimController {
  private scene: Phaser.Scene;
  private turnManager: TurnManager;
  private bots: Bot[];
  private visuals = new Map<number, ArrowVisual>();
  private activeUid: number | null = null;
  private dragOrigin = new Phaser.Math.Vector2();
  private enabled = false;

  private readonly onDown = (p: Phaser.Input.Pointer) => this.handleDown(p);
  private readonly onMove = (p: Phaser.Input.Pointer) => this.handleMove(p);
  private readonly onUp = (p: Phaser.Input.Pointer) => this.handleUp(p);

  constructor(scene: Phaser.Scene, turnManager: TurnManager, bots: Bot[]) {
    this.scene = scene;
    this.turnManager = turnManager;
    this.bots = bots;

    for (const bot of bots) {
      this.visuals.set(bot.uid, {
        arrow: scene.add.graphics().setDepth(20),
        range: scene.add.graphics().setDepth(19),
      });
    }

    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointerupoutside", this.onUp);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.activeUid = null;
  }

  /** Clears every arrow (new aim phase, or handing off in pass & play). */
  resetVisuals(): void {
    for (const bot of this.bots) bot.hasAim = false;
    for (const v of this.visuals.values()) {
      v.arrow.clear();
      v.range.clear();
    }
  }

  setVisible(visible: boolean): void {
    for (const v of this.visuals.values()) {
      v.arrow.setVisible(visible);
      v.range.setVisible(visible);
    }
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointerupoutside", this.onUp);
    for (const v of this.visuals.values()) {
      v.arrow.destroy();
      v.range.destroy();
    }
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || this.turnManager.phase !== "AIMING") return;
    const world = this.toWorld(pointer);
    for (const bot of this.bots) {
      if (Phaser.Math.Distance.Between(world.x, world.y, bot.position.x, bot.position.y) <= HIT_RADIUS) {
        this.activeUid = bot.uid;
        this.dragOrigin.set(bot.position.x, bot.position.y);
        return;
      }
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (this.activeUid === null) return;
    const world = this.toWorld(pointer);
    const dx = world.x - this.dragOrigin.x;
    const dy = world.y - this.dragOrigin.y;
    const aim = computeAim(dx, dy);
    this.drawLiveArrow(this.activeUid, aim.clamped.x, aim.clamped.y);
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    if (this.activeUid === null) return;
    const uid = this.activeUid;
    this.activeUid = null;
    const bot = this.bots.find((b) => b.uid === uid);
    if (!bot) return;

    const world = this.toWorld(pointer);
    const dx = world.x - this.dragOrigin.x;
    const dy = world.y - this.dragOrigin.y;
    const aim = computeAim(dx, dy);

    if (aim.isValid) {
      this.turnManager.setAim(uid, aim.velocity.x, aim.velocity.y);
      bot.hasAim = true;
      this.drawCommittedArrow(uid, aim.clamped.x, aim.clamped.y);
    } else if (this.turnManager.hasAim(uid)) {
      this.turnManager.clearAim(uid);
      bot.hasAim = false;
      const v = this.visuals.get(uid);
      v?.arrow.clear();
      v?.range.clear();
    }
  }

  private toWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private drawLiveArrow(uid: number, dx: number, dy: number): void {
    const bot = this.bots.find((b) => b.uid === uid);
    const v = this.visuals.get(uid);
    if (!bot || !v) return;

    v.range.clear();
    this.drawDashedCircle(v.range, bot.position.x, bot.position.y, MAX_AIM_DISTANCE, 28);

    this.drawArrow(v.arrow, bot.position.x, bot.position.y, dx, dy, TEAM_COLORS[bot.team], 0.92);
  }

  private drawDashedCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, dashCount: number): void {
    g.lineStyle(2.5, 0x7dd3fc, 0.16);
    g.strokeCircle(cx, cy, radius);
    g.lineStyle(3, 0xf1f5f9, 0.45);
    const gapFraction = 0.55;
    for (let i = 0; i < dashCount; i++) {
      const a0 = (Phaser.Math.PI2 * i) / dashCount;
      const a1 = a0 + (Phaser.Math.PI2 / dashCount) * (1 - gapFraction);
      g.beginPath();
      g.arc(cx, cy, radius, a0, a1);
      g.strokePath();
    }
  }

  private drawCommittedArrow(uid: number, dx: number, dy: number): void {
    const bot = this.bots.find((b) => b.uid === uid);
    const v = this.visuals.get(uid);
    if (!bot || !v) return;
    v.range.clear();
    this.drawArrow(v.arrow, bot.position.x, bot.position.y, dx, dy, TEAM_COLORS[bot.team], 1);
  }

  /**
   * Modern "energy blast" style arrow: a soft glow, a tapered shaft that
   * widens towards the tip, a bright core stripe, small power-segment dots,
   * and a concave dart-shaped head. Length still encodes direction/distance;
   * the widening taper, dot count and core brightness together encode power.
   */
  private drawArrow(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: number,
    alpha: number,
  ): void {
    g.clear();
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const power = Phaser.Math.Clamp(len / MAX_AIM_DISTANCE, 0, 1);
    const ux = dx / len;
    const uy = dy / len;
    const perpX = -uy;
    const perpY = ux;
    const endX = x + dx;
    const endY = y + dy;

    const headLen = Math.min(len * 0.6, 16 + power * 12);
    const shaftLen = Math.max(0, len - headLen);
    const shaftX = x + ux * shaftLen;
    const shaftY = y + uy * shaftLen;
    const baseHalfW = 3;
    const tipHalfW = 4 + power * 6;

    const pt = (px: number, py: number, ox: number, oy: number) => new Phaser.Math.Vector2(px + ox, py + oy);

    // Soft outer glow.
    g.lineStyle(12 + power * 10, color, 0.16);
    g.lineBetween(x, y, endX, endY);

    // Tapered shaft.
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        pt(x, y, perpX * baseHalfW, perpY * baseHalfW),
        pt(x, y, -perpX * baseHalfW, -perpY * baseHalfW),
        pt(shaftX, shaftY, -perpX * tipHalfW, -perpY * tipHalfW),
        pt(shaftX, shaftY, perpX * tipHalfW, perpY * tipHalfW),
      ],
      true,
    );

    // Bright energy core.
    const core = shade(color, 90);
    g.fillStyle(core, alpha * 0.85);
    g.fillPoints(
      [
        pt(x, y, perpX * baseHalfW * 0.4, perpY * baseHalfW * 0.4),
        pt(x, y, -perpX * baseHalfW * 0.4, -perpY * baseHalfW * 0.4),
        pt(shaftX, shaftY, -perpX * tipHalfW * 0.4, -perpY * tipHalfW * 0.4),
        pt(shaftX, shaftY, perpX * tipHalfW * 0.4, perpY * tipHalfW * 0.4),
      ],
      true,
    );

    // Power-segment dots along the shaft.
    const dotCount = 2 + Math.round(power * 4);
    for (let i = 1; i <= dotCount; i++) {
      const t = i / (dotCount + 1);
      const dotR = 2 + power * 2.2;
      g.fillStyle(0xffffff, 0.55 * alpha);
      g.fillCircle(x + dx * t * (shaftLen / len), y + dy * t * (shaftLen / len), dotR);
    }

    // Concave dart head.
    const headHalfW = 7 + power * 5;
    const notch = pt(shaftX, shaftY, ux * headLen * 0.32, uy * headLen * 0.32);
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(endX, endY),
        pt(shaftX, shaftY, perpX * headHalfW, perpY * headHalfW),
        notch,
        pt(shaftX, shaftY, -perpX * headHalfW, -perpY * headHalfW),
      ],
      true,
    );
    g.lineStyle(1.5, 0xffffff, 0.35 * alpha);
    g.strokePoints(
      [
        new Phaser.Math.Vector2(endX, endY),
        pt(shaftX, shaftY, perpX * headHalfW, perpY * headHalfW),
        notch,
        pt(shaftX, shaftY, -perpX * headHalfW, -perpY * headHalfW),
      ],
      true,
    );

    // Glow ring anchoring the arrow to the bot.
    g.fillStyle(color, 0.25 * alpha);
    g.fillCircle(x, y, 8);
    g.lineStyle(2, 0xffffff, 0.5 * alpha);
    g.strokeCircle(x, y, 6);
  }
}
