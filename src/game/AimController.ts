import Phaser from "phaser";
import { Bot } from "@/game/entities/Bot";
import { TurnManager } from "@/game/TurnManager";
import { chevronColor, chevronCount, chevronPolygon, computeAim } from "@/game/aiming";
import { BOT_RADIUS, MAX_AIM_DISTANCE } from "@/config/physics";
import { COLORS } from "@/config/theme";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const HIT_RADIUS = BOT_RADIUS * 1.4;

const CHEVRON_OUTLINE = 1.5;

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
  private lastLit = 0;

  private readonly onDown = (p: Phaser.Input.Pointer) => this.handleDown(p);
  private readonly onMove = (p: Phaser.Input.Pointer) => this.handleMove(p);
  private readonly onUp = (p: Phaser.Input.Pointer) => this.handleUp(p);

  /** Called whenever an arrow is set or cleared (drives the "n/3 ready" hint). */
  onAimChange?: () => void;

  constructor(scene: Phaser.Scene, turnManager: TurnManager, bots: Bot[]) {
    this.scene = scene;
    this.turnManager = turnManager;
    this.bots = bots;

    for (const bot of bots) {
      this.visuals.set(bot.uid, {
        arrow: scene.add.graphics().setDepth(9),
        range: scene.add.graphics().setDepth(7),
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
        this.lastLit = 0;
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
      this.onAimChange?.();
    } else if (this.turnManager.hasAim(uid)) {
      this.turnManager.clearAim(uid);
      bot.hasAim = false;
      const v = this.visuals.get(uid);
      v?.arrow.clear();
      v?.range.clear();
      this.onAimChange?.();
    }
  }

  private toWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private drawLiveArrow(uid: number, dx: number, dy: number): void {
    const bot = this.bots.find((b) => b.uid === uid);
    const v = this.visuals.get(uid);
    if (!bot || !v) return;

    const { x, y } = bot.position;
    v.range.clear();
    this.drawRangeCircle(v.range, x, y);
    this.drawArrow(v.arrow, x, y, dx, dy, uid);
  }

  /** Dashed circle marking the maximum pull, faintly filled, like the mockup. */
  private drawRangeCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.fillStyle(0xffffff, 0.06);
    g.fillCircle(cx, cy, MAX_AIM_DISTANCE);
    g.lineStyle(3, 0xffffff, 0.6);
    const dashes = 30;
    for (let i = 0; i < dashes; i++) {
      const a0 = (Phaser.Math.PI2 * i) / dashes;
      g.beginPath();
      g.arc(cx, cy, MAX_AIM_DISTANCE, a0, a0 + Phaser.Math.PI2 / dashes / 2);
      g.strokePath();
    }
  }

  private drawCommittedArrow(uid: number, dx: number, dy: number): void {
    const bot = this.bots.find((b) => b.uid === uid);
    const v = this.visuals.get(uid);
    if (!bot || !v) return;
    v.range.clear();
    this.drawArrow(v.arrow, bot.position.x, bot.position.y, dx, dy);
  }

  /**
   * Continuous arrow of solid chevrons glued together, small and green near the bot, bigger and
   * red towards the tip. Drawn beneath the bot (depth 9 < 10) so it never covers its face.
   */
  private drawArrow(g: Phaser.GameObjects.Graphics, x: number, y: number, dx: number, dy: number, uid?: number): void {
    g.clear();
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;
    const count = chevronCount(len);
    if (uid !== undefined) this.notifyPower(uid, count);

    // Tip first, so each smaller chevron nests on top of the next one's notch.
    for (let i = count - 1; i >= 0; i--) {
      const pts = chevronPolygon(i, BOT_RADIUS).map(
        (p) => new Phaser.Math.Vector2(x + ux * p.x - uy * p.y, y + uy * p.x + ux * p.y),
      );
      g.fillStyle(chevronColor(i), 1);
      g.fillPoints(pts, true);
      g.lineStyle(CHEVRON_OUTLINE * (BOT_RADIUS / 18), COLORS.botVisor, 1);
      g.strokePoints(pts, true, true);
    }
  }

  /** Light haptic tick each time a chevron is added while dragging. */
  private notifyPower(uid: number, count: number): void {
    if (uid !== this.activeUid || count === this.lastLit) return;
    if (count > this.lastLit) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    this.lastLit = count;
  }
}
