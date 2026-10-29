import { PARTS, PartId } from "@/config/parts";
import { BotParts } from "@/game/entities/BotParts";
import { Rng } from "@/game/Rng";

/**
 * Decides when a collision is hard enough to knock a part off a bot. Time comes from the
 * fixed-step simulation clock (not wall-clock), keeping the outcome reproducible.
 */
export class DamageSystem {
  private bots = new Map<number, BotParts>();
  private lastLossAt = new Map<number, number>();

  constructor(
    private readonly rng: Rng,
    private readonly config: Pick<typeof PARTS, "impactSpeedThreshold" | "lossCooldownMs"> = PARTS,
  ) {}

  register(botId: number, parts: BotParts): void {
    this.bots.set(botId, parts);
  }

  /**
   * Reports a bot–bot or bot–wall impact. `speed` is the closing speed along the contact normal.
   * Returns the part that fell off, or null (soft hit, cooldown, or nothing left to lose).
   */
  onImpact(botId: number, speed: number, nowMs: number): PartId | null {
    if (speed < this.config.impactSpeedThreshold) return null;
    const parts = this.bots.get(botId);
    if (!parts) return null;

    const last = this.lastLossAt.get(botId);
    if (last !== undefined && nowMs - last < this.config.lossCooldownMs) return null;

    const lost = parts.loseRandom(this.rng);
    if (lost) this.lastLossAt.set(botId, nowMs);
    return lost;
  }

  /** Forgets cooldowns (new match). */
  reset(): void {
    this.lastLossAt.clear();
  }
}
