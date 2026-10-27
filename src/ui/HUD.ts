import Phaser from "phaser";
import { GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import { createButton } from "@/ui/Button";

export class HUD {
  private panel: Phaser.GameObjects.Graphics;
  private scoreText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private timerBarBg: Phaser.GameObjects.Graphics;
  private timerBarFill: Phaser.GameObjects.Graphics;
  private turnLabel: Phaser.GameObjects.Text;
  private goButton: Phaser.GameObjects.Container;
  private pauseButton: Phaser.GameObjects.Container;

  private readonly panelW = 380;
  private readonly panelH = 118;
  private readonly barX = GAME_WIDTH / 2 - 150;
  private readonly barY = 76;
  private readonly barW = 300;
  private readonly barH = 12;

  constructor(scene: Phaser.Scene, onGo: () => void, onPause: () => void) {
    this.panel = scene.add.graphics().setDepth(48);
    this.panel.fillStyle(0x0b1220, 0.42);
    this.panel.fillRoundedRect(GAME_WIDTH / 2 - this.panelW / 2, 4, this.panelW, this.panelH, 20);
    this.panel.lineStyle(1.5, 0xffffff, 0.1);
    this.panel.strokeRoundedRect(GAME_WIDTH / 2 - this.panelW / 2, 4, this.panelW, this.panelH, 20);

    this.scoreText = scene.add
      .text(GAME_WIDTH / 2, 34, "0  -  0", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "42px",
        color: "#f8fafc",
        fontStyle: "800",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.turnLabel = scene.add
      .text(GAME_WIDTH / 2, 100, "", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "20px",
        color: "#c9d1d9",
        fontStyle: "600",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.timerBarBg = scene.add.graphics().setDepth(50);
    this.timerBarBg.fillStyle(0x000000, 0.4);
    this.timerBarBg.fillRoundedRect(this.barX, this.barY, this.barW, this.barH, 6);

    this.timerBarFill = scene.add.graphics().setDepth(51);

    this.timerText = scene.add
      .text(GAME_WIDTH / 2 + this.barW / 2 + 26, this.barY + this.barH / 2, "15", {
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "22px",
        color: "#f8fafc",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.goButton = createButton(scene, GAME_WIDTH - 130, 790, "GO", onGo, {
      width: 170,
      height: 92,
      fillColor: 0x16a34a,
      fontSize: 36,
      icon: "play",
    });
    this.goButton.setDepth(50);

    this.pauseButton = createButton(scene, GAME_WIDTH - 60, 50, "II", onPause, {
      width: 76,
      height: 60,
      fillColor: 0x475569,
      fontSize: 26,
    });
    this.pauseButton.setDepth(50);
  }

  setScore(score: Record<TeamId, number>): void {
    this.scoreText.setText(`${score.red}  -  ${score.yellow}`);
  }

  setAimTimer(remainingMs: number, durationMs: number): void {
    const ratio = Phaser.Math.Clamp(remainingMs / durationMs, 0, 1);
    this.timerText.setText(Math.ceil(remainingMs / 1000).toString());
    this.timerBarFill.clear();
    const color = ratio > 0.3 ? 0x22c55e : 0xef4444;
    this.timerBarFill.fillStyle(color, 1);
    this.timerBarFill.fillRoundedRect(this.barX, this.barY, this.barW * ratio, this.barH, 6);
  }

  setTurnLabel(text: string): void {
    this.turnLabel.setText(text);
  }

  setTurnColor(team: TeamId | null): void {
    this.turnLabel.setColor(team ? Phaser.Display.Color.ValueToColor(TEAM_COLORS[team]).rgba : "#c9d1d9");
  }

  setGoVisible(visible: boolean): void {
    this.goButton.setVisible(visible);
  }

  setTimerVisible(visible: boolean): void {
    this.timerBarBg.setVisible(visible);
    this.timerBarFill.setVisible(visible);
    this.timerText.setVisible(visible);
  }

  destroy(): void {
    this.panel.destroy();
    this.scoreText.destroy();
    this.timerText.destroy();
    this.timerBarBg.destroy();
    this.timerBarFill.destroy();
    this.turnLabel.destroy();
    this.goButton.destroy();
    this.pauseButton.destroy();
  }
}
