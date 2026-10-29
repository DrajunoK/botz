import { ALARM, PANIC_LEVELS, PanicLevel, PanicLevelConfig } from "@/config/alarmClock";

export function panicLevelForTurn(turn: number): PanicLevel {
  let level: PanicLevel = 0;
  for (const cfg of PANIC_LEVELS) {
    if (turn >= cfg.fromTurn) level = cfg.id;
  }
  return level;
}

export function panicConfig(level: PanicLevel): PanicLevelConfig {
  return PANIC_LEVELS[level];
}

/**
 * Tracks how worked-up the alarm clock is. The level follows the turn number, but a goal
 * calms it down by one notch so the game can breathe without restarting from zero.
 */
export class PanicTracker {
  private effectiveTurn = 1;

  constructor(private readonly dropOnGoal: number = ALARM.panicDropOnGoal) {}

  get turn(): number {
    return this.effectiveTurn;
  }

  get level(): PanicLevel {
    return panicLevelForTurn(this.effectiveTurn);
  }

  /** Call at the start of every aiming phase after the first. */
  advance(): void {
    this.effectiveTurn += 1;
  }

  /** Call when a goal is scored: drops `dropOnGoal` levels (the next `advance()` lands on the lower level's first turn). */
  onGoal(): void {
    if (this.dropOnGoal <= 0) return;
    const target = Math.max(0, this.level - this.dropOnGoal) as PanicLevel;
    this.effectiveTurn = PANIC_LEVELS[target].fromTurn - 1;
  }
}
