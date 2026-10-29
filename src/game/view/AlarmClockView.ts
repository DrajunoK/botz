import Phaser from "phaser";
import { PanicLevel } from "@/config/alarmClock";
import { COLORS, FONTS } from "@/config/theme";
import { CLOCK_RADIUS } from "@/config/physics";
import { CLOCK_ART_RADIUS, ClockArtState, drawAlarmClock, drawClockShadow, zzzOffsets } from "@/game/view/alarmClockArt";
import { fillSpark } from "@/game/view/draw";

const ART_SCALE = (CLOCK_RADIUS / CLOCK_ART_RADIUS) * 1.1;

export interface ClockViewState {
  x: number;
  y: number;
  level: PanicLevel;
  /** Free-running clock, seconds. */
  time: number;
  handAngle: number;
  stunned: boolean;
  /** Visual tremble amplitude in px (0 when calm or stunned). */
  shake: number;
}

/** Renders the alarm clock: case, bells, face, hands, vibration, Z's, notes, stun stars. */
export class AlarmClockView {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly zs: Phaser.GameObjects.Text[];
  private readonly notes: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.graphics().setDepth(8).setScale(ART_SCALE);
    drawClockShadow(this.shadow);
    this.body = scene.add.graphics().setDepth(12).setScale(ART_SCALE);
    this.stars = scene.add.graphics().setDepth(13);

    const small = { fontFamily: FONTS.body, fontStyle: "600", color: COLORS.textSoft };
    this.zs = [scene.add.text(0, 0, "z", { ...small, fontSize: "20px" }), scene.add.text(0, 0, "Z", { ...small, fontSize: "28px" })];
    const note = { fontFamily: FONTS.body, color: "#ffd36e", fontSize: "30px" };
    this.notes = [scene.add.text(0, 0, "♪", note), scene.add.text(0, 0, "♫", note)];
    for (const t of [...this.zs, ...this.notes]) t.setOrigin(0.5).setDepth(14);
  }

  sync(s: ClockViewState): void {
    const ox = s.shake > 0 ? Math.sin(s.time * 83) * s.shake : 0;
    const oy = s.shake > 0 ? Math.cos(s.time * 71) * s.shake * 0.6 : 0;
    const x = s.x + ox;
    const y = s.y + oy;

    const art: ClockArtState = {
      level: s.level,
      time: s.time,
      handAngle: s.handAngle,
      stunned: s.stunned,
      ringing: !s.stunned && s.level >= 2,
    };
    drawAlarmClock(this.body, art);
    this.body.setPosition(x, y).setRotation(s.shake > 0 ? Math.sin(s.time * 47) * 0.05 * (s.shake / 3) : 0);
    this.shadow.setPosition(s.x, s.y);

    // Sleeping Z's (level 0, not stunned).
    const sleeping = s.level === 0 && !s.stunned;
    const zz = zzzOffsets(s.time);
    this.zs.forEach((t, i) => {
      t.setVisible(sleeping);
      if (sleeping) t.setPosition(s.x + zz[i].x * ART_SCALE, s.y + zz[i].y * ART_SCALE).setAlpha(zz[i].alpha);
    });

    // Floating notes (levels 1–3, not stunned).
    const singing = s.level >= 1 && !s.stunned;
    this.notes.forEach((t, i) => {
      t.setVisible(singing);
      if (singing) {
        const phase = (s.time * (0.8 + s.level * 0.4) + i * 0.5) % 1;
        const side = i === 0 ? -1 : 1;
        t.setPosition(s.x + side * (30 + phase * 14) * ART_SCALE * 0.9, s.y - (22 + phase * 26) * ART_SCALE * 0.9).setAlpha(1 - phase * phase);
      }
    });

    // Stun stars orbiting above.
    this.stars.clear();
    if (s.stunned) {
      for (let i = 0; i < 3; i++) {
        const a = s.time * 5 + (i * Math.PI * 2) / 3;
        fillSpark(this.stars, s.x + Math.cos(a) * 24, s.y - 52 * ART_SCALE * 0.8 + Math.sin(a) * 7, 7, COLORS.spark);
      }
    }
  }

  destroy(): void {
    this.shadow.destroy();
    this.body.destroy();
    this.stars.destroy();
    for (const t of [...this.zs, ...this.notes]) t.destroy();
  }
}
