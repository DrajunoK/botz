import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, Difficulty, TEAM_COLORS } from "@/config/game";
import { SceneKeys } from "./keys";
import { createButton } from "@/ui/Button";
import { SettingsStore } from "@/state/settings";
import { MatchConfig } from "@/game/MatchConfig";
import { drawBotIcon } from "@/game/entities/botArt";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Facile",
  normal: "Normal",
  hard: "Difficile",
};

const BG_TOP = 0x0b1020;
const BG_BOTTOM = 0x161d33;

export class MenuScene extends Phaser.Scene {
  private settingsPanel?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.drawBackground();
    this.drawMascots();
    this.drawTitle();

    createButton(this, GAME_WIDTH / 2, 470, "Solo", () => this.startMatch("solo"), {
      fillColor: TEAM_COLORS.red,
      icon: "play",
    });
    createButton(this, GAME_WIDTH / 2, 570, "2 joueurs", () => this.startMatch("passPlay"), {
      fillColor: TEAM_COLORS.yellow,
      textColor: "#111827",
      icon: "duo",
    });
    createButton(this, GAME_WIDTH / 2, 670, "Réglages", () => this.toggleSettings(), {
      fillColor: 0x475569,
      icon: "gear",
    });
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-20);
    g.fillGradientStyle(BG_TOP, BG_TOP, BG_BOTTOM, BG_BOTTOM, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const glow = this.add.graphics().setDepth(-19);
    glow.fillStyle(TEAM_COLORS.red, 0.16);
    glow.fillCircle(GAME_WIDTH * 0.14, GAME_HEIGHT * 0.18, 320);
    glow.fillStyle(TEAM_COLORS.yellow, 0.13);
    glow.fillCircle(GAME_WIDTH * 0.88, GAME_HEIGHT * 0.85, 360);
    glow.fillStyle(0x38bdf8, 0.08);
    glow.fillCircle(GAME_WIDTH * 0.8, GAME_HEIGHT * 0.12, 260);

    // Faint dot grid for texture.
    const dots = this.add.graphics().setDepth(-18);
    dots.fillStyle(0xffffff, 0.05);
    for (let gx = 40; gx < GAME_WIDTH; gx += 56) {
      for (let gy = 40; gy < GAME_HEIGHT; gy += 56) {
        dots.fillCircle(gx, gy, 2);
      }
    }
  }

  private drawMascots(): void {
    const red = this.add.graphics().setDepth(-10).setAlpha(0.9);
    drawBotIcon(red, TEAM_COLORS.red, 46);
    red.setPosition(GAME_WIDTH * 0.16, GAME_HEIGHT * 0.62);
    red.setAngle(-8);

    const yellow = this.add.graphics().setDepth(-10).setAlpha(0.9);
    drawBotIcon(yellow, TEAM_COLORS.yellow, 46);
    yellow.setPosition(GAME_WIDTH * 0.85, GAME_HEIGHT * 0.3);
    yellow.setAngle(10);

    this.tweens.add({ targets: red, y: red.y - 14, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({
      targets: yellow,
      y: yellow.y - 18,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
      delay: 300,
    });
  }

  private drawTitle(): void {
    const glowLayers = [
      { scale: 1.18, alpha: 0.12 },
      { scale: 1.08, alpha: 0.18 },
    ];
    for (const layer of glowLayers) {
      this.add
        .text(GAME_WIDTH / 2, 190, "BOTZ", {
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: "132px",
          color: "#7dd3fc",
          fontStyle: "900",
        })
        .setOrigin(0.5)
        .setScale(layer.scale)
        .setAlpha(layer.alpha)
        .setBlendMode(Phaser.BlendModes.ADD);
    }

    this.add
      .text(GAME_WIDTH / 2, 194, "BOTZ", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "132px",
        color: "#000000",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setAlpha(0.3);

    this.add
      .text(GAME_WIDTH / 2, 190, "BOTZ", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "132px",
        color: "#f8fafc",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 288, "MINI-FOOT DE ROBOTS RONDS", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "26px",
        color: "#93a4bd",
        fontStyle: "600",
      })
      .setOrigin(0.5)
      .setLetterSpacing(4);
  }

  private startMatch(mode: MatchConfig["mode"]): void {
    const config: MatchConfig = { mode, difficulty: SettingsStore.get().difficulty };
    this.scene.start(SceneKeys.Game, config);
  }

  private toggleSettings(): void {
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = undefined;
      return;
    }
    this.settingsPanel = this.buildSettingsPanel();
  }

  private buildSettingsPanel(): Phaser.GameObjects.Container {
    const panelW = 660;
    const panelH = 360;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55);
    dim.fillRect(-cx, -cy, GAME_WIDTH, GAME_HEIGHT);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(-panelW / 2 + 8, -panelH / 2 + 14, panelW, panelH, 28);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1c2440, 0x1c2440, 0x141a30, 0x141a30, 1, 1, 1, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
    bg.lineStyle(2, 0x3b4568, 1);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);

    const title = this.add
      .text(0, -panelH / 2 + 54, "Réglages", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "38px",
        color: "#f8fafc",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const soundLabel = this.add
      .text(-panelW / 2 + 44, -30, "Son", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "28px",
        color: "#c9d1d9",
      })
      .setOrigin(0, 0.5);

    const elements: Phaser.GameObjects.GameObject[] = [dim, shadow, bg, title, soundLabel];

    const soundOn = SettingsStore.get().soundOn;
    const soundToggle = createButton(
      this,
      panelW / 2 - 140,
      -30,
      soundOn ? "Activé" : "Coupé",
      () => {
        SettingsStore.setSoundOn(!SettingsStore.get().soundOn);
        this.refreshSettingsPanel();
      },
      { width: 200, height: 60, fillColor: soundOn ? 0x16a34a : 0x475569, fontSize: 24 },
    );
    elements.push(soundToggle);

    const diffLabel = this.add
      .text(-panelW / 2 + 44, 55, "Difficulté (Solo)", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "28px",
        color: "#c9d1d9",
      })
      .setOrigin(0, 0.5);
    elements.push(diffLabel);

    DIFFICULTIES.forEach((diff, i) => {
      const active = SettingsStore.get().difficulty === diff;
      const btn = createButton(
        this,
        -panelW / 2 + 135 + i * 195,
        135,
        DIFFICULTY_LABEL[diff],
        () => {
          SettingsStore.setDifficulty(diff);
          this.refreshSettingsPanel();
        },
        { width: 175, height: 60, fillColor: active ? 0x2563eb : 0x475569, fontSize: 22 },
      );
      elements.push(btn);
    });

    const closeBtn = createButton(this, 0, panelH / 2 - 58, "Fermer", () => this.toggleSettings(), {
      width: 200,
      height: 56,
      fillColor: 0x475569,
      fontSize: 24,
    });
    elements.push(closeBtn);

    const container = this.add.container(cx, cy, elements);
    container.setDepth(500);
    return container;
  }

  private refreshSettingsPanel(): void {
    this.settingsPanel?.destroy();
    this.settingsPanel = this.buildSettingsPanel();
  }
}
