import { SettingsStore } from "@/state/settings";

/**
 * Tiny synthesized sound-effect player (Web Audio oscillators, no audio
 * files). Lazily creates its AudioContext on first use, since browsers
 * refuse to start one before a user gesture — the first tap/click in the
 * game satisfies that.
 */
class SFXPlayer {
  private ctx: AudioContext | null = null;
  private lastImpactAt = 0;

  private getContext(): AudioContext | null {
    if (!SettingsStore.get().soundOn) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, durationSec: number, type: OscillatorType, peakGain: number, delaySec = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  playClick(): void {
    this.tone(720, 0.08, "triangle", 0.18);
  }

  /** Short percussive blip for bot/ball/wall impacts. `intensity` in [0,1]. Throttled to avoid overlap spam. */
  playImpact(intensity: number): void {
    const now = performance.now();
    if (now - this.lastImpactAt < 40) return;
    this.lastImpactAt = now;
    const clamped = Math.max(0, Math.min(1, intensity));
    this.tone(140 + clamped * 90, 0.09, "square", 0.05 + clamped * 0.12);
  }

  /** Metallic "clonk" of a part coming off. */
  playClonk(): void {
    this.tone(210, 0.12, "square", 0.16);
    this.tone(95, 0.2, "triangle", 0.22, 0.03);
    this.tone(1250, 0.05, "square", 0.05, 0.015);
  }

  /** Alarm bell ring, brighter and faster-paced with panic (0–3). */
  playRing(level: number): void {
    const f = 1500 + level * 160;
    this.tone(f, 0.07, "square", 0.05 + level * 0.012);
    this.tone(f * 1.26, 0.07, "square", 0.04 + level * 0.012, 0.075);
  }

  /** Dazed "bwoing" when a hard hit stuns the clock. */
  playStun(): void {
    this.tone(520, 0.25, "sine", 0.18);
    this.tone(330, 0.3, "sine", 0.16, 0.1);
  }

  /** Metallic "plouf" of a bot dropping into the lava. */
  playSplash(): void {
    this.tone(260, 0.18, "sine", 0.2);
    this.tone(120, 0.3, "triangle", 0.22, 0.05);
    this.tone(70, 0.35, "sine", 0.18, 0.12);
  }

  playGoal(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => this.tone(f, 0.28, "triangle", 0.22, i * 0.09));
  }

  playWhistleShort(): void {
    this.tone(1500, 0.15, "sawtooth", 0.1);
  }
}

export const SFX = new SFXPlayer();
