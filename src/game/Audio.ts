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

  playGoal(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => this.tone(f, 0.28, "triangle", 0.22, i * 0.09));
  }

  playWhistleShort(): void {
    this.tone(1500, 0.15, "sawtooth", 0.1);
  }
}

export const SFX = new SFXPlayer();
