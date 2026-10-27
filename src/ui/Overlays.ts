import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TEAM_COLORS, TeamId } from "@/config/game";
import { createButton } from "@/ui/Button";
import { drawBotIcon } from "@/game/entities/botArt";

function dimBackground(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x05070d, alpha);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  return g;
}

/** Rounded glass card, centered at the given point — used by pause/handoff overlays for a consistent look. */
function glassCard(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(cx - w / 2 + 8, cy - h / 2 + 12, w, h, 28);
  g.fillGradientStyle(0x1c2440, 0x1c2440, 0x141a30, 0x141a30, 1, 1, 1, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 28);
  g.lineStyle(2, 0xffffff, 0.1);
  g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 28);
  return g;
}

export function createPauseOverlay(
  scene: Phaser.Scene,
  handlers: { onResume: () => void; onRestart: () => void; onQuit: () => void },
): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const elements: Phaser.GameObjects.GameObject[] = [];
  elements.push(dimBackground(scene));
  elements.push(glassCard(scene, cx, cy, 520, 460));

  const title = scene.add
    .text(cx, cy - 170, "Pause", {
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: "52px",
      color: "#f8fafc",
      fontStyle: "800",
    })
    .setOrigin(0.5);
  elements.push(title);

  elements.push(
    createButton(scene, cx, cy - 40, "Reprendre", handlers.onResume, {
      fillColor: 0x16a34a,
      icon: "play",
    }),
  );
  elements.push(
    createButton(scene, cx, cy + 70, "Recommencer", handlers.onRestart, {
      fillColor: 0x2563eb,
    }),
  );
  elements.push(
    createButton(scene, cx, cy + 180, "Quitter", handlers.onQuit, {
      fillColor: 0x475569,
    }),
  );

  const container = scene.add.container(0, 0, elements);
  container.setDepth(200);
  return container;
}

export function createHandoffOverlay(
  scene: Phaser.Scene,
  team: TeamId,
  onContinue: () => void,
): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const label = team === "red" ? "ROUGE" : "JAUNE";
  const color = TEAM_COLORS[team];

  const elements: Phaser.GameObjects.GameObject[] = [];
  elements.push(dimBackground(scene, 0.94));
  elements.push(glassCard(scene, cx, cy, 560, 440));

  const mascot = scene.add.graphics();
  drawBotIcon(mascot, color, 58, team === "red" ? 1 : -1);
  mascot.setPosition(cx, cy - 150);
  elements.push(mascot);

  const title = scene.add
    .text(cx, cy - 30, "Passe le téléphone", {
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: "44px",
      color: "#f8fafc",
      fontStyle: "800",
    })
    .setOrigin(0.5);
  elements.push(title);

  const subtitle = scene.add
    .text(cx, cy + 32, `Au joueur ${label}`, {
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: "32px",
      color: Phaser.Display.Color.ValueToColor(color).rgba,
      fontStyle: "700",
    })
    .setOrigin(0.5);
  elements.push(subtitle);

  elements.push(
    createButton(scene, cx, cy + 150, "Prêt", onContinue, {
      fillColor: color,
      textColor: team === "yellow" ? "#111827" : "#ffffff",
      width: 240,
    }),
  );

  const container = scene.add.container(0, 0, elements);
  container.setDepth(200);
  return container;
}

/** Small, fast speck burst for bot/ball/wall impacts — no flash, just a quick pop. */
export function playImpactBurst(scene: Phaser.Scene, x: number, y: number, intensity: number): void {
  const count = 4 + Math.round(intensity * 5);
  const specks: { angle: number }[] = [];
  for (let i = 0; i < count; i++) {
    specks.push({ angle: Math.random() * Math.PI * 2 });
  }

  const g = scene.add.graphics().setDepth(140);
  const tweenTarget = { t: 0 };
  scene.tweens.add({
    targets: tweenTarget,
    t: 1,
    duration: 220 + intensity * 100,
    onUpdate: () => {
      g.clear();
      g.fillStyle(0xf1f5f9, (1 - tweenTarget.t) * 0.8);
      for (const s of specks) {
        const d = tweenTarget.t * (18 + intensity * 34);
        g.fillCircle(x + Math.cos(s.angle) * d, y + Math.sin(s.angle) * d, 2.5);
      }
    },
    onComplete: () => g.destroy(),
  });
}

/** Brief full-screen flash + team-colored burst, auto-destroys itself. */
export function playGoalFlash(scene: Phaser.Scene, team: TeamId, x: number, y: number): void {
  const color = TEAM_COLORS[team];

  const flash = scene.add.graphics().setDepth(150);
  flash.fillStyle(0xffffff, 0.55);
  flash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 350,
    onComplete: () => flash.destroy(),
  });

  const particles = scene.add.graphics().setDepth(151);
  const count = 16;
  const specks: { angle: number; dist: number }[] = [];
  for (let i = 0; i < count; i++) {
    specks.push({ angle: (Math.PI * 2 * i) / count, dist: 0 });
  }
  const tweenTarget = { t: 0 };
  scene.tweens.add({
    targets: tweenTarget,
    t: 1,
    duration: 500,
    onUpdate: () => {
      particles.clear();
      particles.fillStyle(color, 1 - tweenTarget.t);
      for (const s of specks) {
        const d = 10 + s.dist + tweenTarget.t * 140;
        particles.fillCircle(x + Math.cos(s.angle) * d, y + Math.sin(s.angle) * d, 6);
      }
    },
    onComplete: () => particles.destroy(),
  });
}
