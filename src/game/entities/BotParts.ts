import { ALL_PARTS, PARTS, PartId } from "@/config/parts";
import { Rng } from "@/game/Rng";

/**
 * Which of a bot's four parts are still attached, and what that means for how it
 * moves. Pure logic (no Phaser) so the effects can be unit-tested headless.
 */
export class BotParts {
  private present = new Set<PartId>(ALL_PARTS);

  has(part: PartId): boolean {
    return this.present.has(part);
  }

  get remaining(): PartId[] {
    return ALL_PARTS.filter((p) => this.present.has(p));
  }

  get lostCount(): number {
    return ALL_PARTS.length - this.present.size;
  }

  /** No part left: toujours jouable, mais très léger, imprécis et fumant. */
  get isWreck(): boolean {
    return this.present.size === 0;
  }

  /** Detaches one specific part. Returns false if it was already gone. */
  lose(part: PartId): boolean {
    return this.present.delete(part);
  }

  /** Detaches a random remaining part (seeded). Returns it, or null for a wreck. */
  loseRandom(rng: Rng): PartId | null {
    const left = this.remaining;
    if (left.length === 0) return null;
    const part = rng.pick(left);
    this.present.delete(part);
    return part;
  }

  repair(): void {
    this.present = new Set(ALL_PARTS);
  }

  /** Multiplier on the bot's original mass. */
  get massFactor(): number {
    return 1 - this.lostCount * PARTS.massLossPerPart;
  }

  /** Lighter bots leave faster for the same arrow. */
  get shotSpeedMultiplier(): number {
    return 1 + this.lostCount * PARTS.shotSpeedBonusPerPart;
  }

  /** Random heading error (radians) added to the intended shot direction. 0 with an antenna. */
  aimErrorRad(rng: Rng): number {
    let deg = 0;
    if (!this.has("antenna")) deg += PARTS.antennaNoiseDeg;
    if (this.isWreck) deg += PARTS.wreckExtraNoiseDeg;
    return deg === 0 ? 0 : (rng.spread(deg) * Math.PI) / 180;
  }

  /**
   * Heading rotation rate in rad/s, in screen space (y down): positive turns clockwise,
   * i.e. towards the bot's right. A missing left arm curves right, a missing right arm
   * curves left; with both gone they cancel.
   */
  get driftRate(): number {
    let rate = 0;
    if (!this.has("armLeft")) rate += PARTS.armDriftRadPerSec;
    if (!this.has("armRight")) rate -= PARTS.armDriftRadPerSec;
    return rate;
  }
}
