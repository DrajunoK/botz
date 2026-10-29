import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TEAM_COLORS, TEAM_LABEL, TeamId } from "@/config/game";
import { COLORS } from "@/config/theme";
import { createButton } from "@/ui/Button";
import { bodyText, hex, titleText } from "@/ui/ui";
import { BOT_ART_RADIUS, drawBot } from "@/game/view/botArt";
import { BotParts } from "@/game/entities/BotParts";
import { fillSpark } from "@/game/view/draw";
import { Rng } from "@/game/Rng";

/** Cosmetic randomness only (particle angles): gameplay never reads from this generator. */
const fxRng = new Rng(0xb07a);

function dimBackground(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x070a16, alpha);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // Swallow taps so nothing under the overlay reacts.
  g.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
  return g;
}

/** Dark card with the blue-gray border, centered at the given point. */
export function card(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(cx - w / 2, cy - h / 2 + 10, w, h, 30);
  g.fillStyle(COLORS.night, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 30);
  g.lineStyle(4, COLORS.panelBorder, 1);
  g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 30);
  return g;
}

/** A bot mascot (full parts), sized by body radius. */
export function botMascot(scene: Phaser.Scene, x: number, y: number, color: number, radius: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawBot(g, color, new BotParts());
  g.setPosition(x, y).setScale(radius / BOT_ART_RADIUS);
  return g;
}

export function createPauseOverlay(
  scene: Phaser.Scene,
  handlers: { onResume: () => void; onRestart: () => void; onQuit: () => void },
): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const elements: Phaser.GameObjects.GameObject[] = [dimBackground(scene), card(scene, cx, cy, 520, 500)];

  elements.push(scene.add.text(cx, cy - 175, "PAUSE", titleText(56, hex(COLORS.yellow))).setOrigin(0.5));
  elements.push(createButton(scene, cx, cy - 50, "Reprendre", handlers.onResume, { variant: "primary" }));
  elements.push(createButton(scene, cx, cy + 60, "Recommencer", handlers.onRestart, { variant: "ghost" }));
  elements.push(createButton(scene, cx, cy + 170, "Quitter", handlers.onQuit, { variant: "danger" }));

  return scene.add.container(0, 0, elements).setDepth(200);
}

export function createHandoffOverlay(scene: Phaser.Scene, team: TeamId, onContinue: () => void): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const color = TEAM_COLORS[team];

  const elements: Phaser.GameObjects.GameObject[] = [dimBackground(scene, 0.96), card(scene, cx, cy, 640, 520)];
  elements.push(botMascot(scene, cx, cy - 150, color, 64));
  elements.push(scene.add.text(cx, cy - 30, "PASSE LE TÉLÉPHONE", titleText(36)).setOrigin(0.5));
  elements.push(scene.add.text(cx, cy + 30, `Au joueur ${TEAM_LABEL[team]}`, bodyText(34, hex(color), "700")).setOrigin(0.5));
  elements.push(
    createButton(scene, cx, cy + 140, "Prêt", onContinue, {
      variant: team === "yellow" ? "primary" : "danger",
      width: 260,
    }),
  );

  return scene.add.container(0, 0, elements).setDepth(200);
}

/** Quick 4-point sparks, used when two bodies hit hard. */
export function playImpactBurst(scene: Phaser.Scene, x: number, y: number, intensity: number): void {
  const count = 2 + Math.round(intensity * 3);
  const sparks = Array.from({ length: count }, () => ({ angle: fxRng.range(0, Math.PI * 2), size: fxRng.range(5, 9), reach: fxRng.range(0.7, 1.2) }));

  const g = scene.add.graphics().setDepth(140);
  const t = { v: 0 };
  scene.tweens.add({
    targets: t,
    v: 1,
    duration: 260 + intensity * 120,
    onUpdate: () => {
      g.clear();
      for (const s of sparks) {
        const d = t.v * (16 + intensity * 38) * s.reach;
        fillSpark(g, x + Math.cos(s.angle) * d, y + Math.sin(s.angle) * d, s.size * (1 - t.v * 0.5), COLORS.spark, 1 - t.v);
      }
    },
    onComplete: () => g.destroy(),
  });
}

/** A part comes off: a bigger shower of sparks. */
export function playPartLostBurst(scene: Phaser.Scene, x: number, y: number): void {
  playImpactBurst(scene, x, y, 1);
  const text = scene.add.text(x, y - 46, "CLONK !", titleText(22, "#ffffff")).setOrigin(0.5).setDepth(141).setStroke("#141b31", 6);
  scene.tweens.add({ targets: text, y: y - 90, alpha: 0, duration: 700, ease: "Quad.Out", onComplete: () => text.destroy() });
}

/** Full-screen flash, team-colored burst and a big "BUT !" that pops in. */
export function playGoalFlash(scene: Phaser.Scene, team: TeamId, x: number, y: number): void {
  const color = TEAM_COLORS[team];

  const flash = scene.add.graphics().setDepth(150);
  flash.fillStyle(0xffffff, 0.5);
  flash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });

  const burst = scene.add.graphics().setDepth(151);
  const count = 18;
  const t = { v: 0 };
  scene.tweens.add({
    targets: t,
    v: 1,
    duration: 650,
    onUpdate: () => {
      burst.clear();
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count;
        const d = 20 + t.v * 170;
        fillSpark(burst, x + Math.cos(a) * d, y + Math.sin(a) * d, 12 * (1 - t.v * 0.6), i % 2 ? color : COLORS.spark, 1 - t.v);
      }
    },
    onComplete: () => burst.destroy(),
  });

  const label = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "BUT !", titleText(150, hex(color)))
    .setOrigin(0.5)
    .setDepth(152)
    .setStroke("#141b31", 14)
    .setScale(0.2)
    .setAngle(-6);
  scene.tweens.add({ targets: label, scale: 1, duration: 260, ease: "Back.Out" });
  scene.tweens.add({ targets: label, alpha: 0, delay: 650, duration: 250, onComplete: () => label.destroy() });
}
