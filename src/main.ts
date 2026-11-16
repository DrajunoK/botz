import Phaser from "phaser";
import "./styles.css";
import { GAME_HEIGHT } from "@/config/game";
import { gameWidthForAspect } from "@/config/viewport";
import { fitGameWidthToScreen } from "@/ui/viewport";
import { GRAVITY } from "@/config/physics";
import { BootScene } from "@/scenes/BootScene";
import { MenuScene } from "@/scenes/MenuScene";
import { GameScene } from "@/scenes/GameScene";
import { ResultScene } from "@/scenes/ResultScene";
import { RankingScene } from "@/scenes/RankingScene";
import { StatsScene } from "@/scenes/StatsScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#141b31",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: gameWidthForAspect(window.innerWidth / window.innerHeight),
    height: GAME_HEIGHT,
  },
  physics: {
    default: "matter",
    matter: {
      gravity: GRAVITY,
      // GameScene steps Matter itself with a fixed timestep (see src/config/physics.ts)
      // so the simulation is reproducible across devices / framerates.
      autoUpdate: false,
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene, RankingScene, StatsScene],
};

const game = new Phaser.Game(config);

// Browsers report a stale viewport size right after a rotation (and in standalone mode), which leaves
// the canvas at the previous orientation's size: re-measure a few times.
const refreshScale = (): void => {
  fitGameWidthToScreen(game);
  for (const ms of [100, 300, 600]) window.setTimeout(() => fitGameWidthToScreen(game), ms);
};
window.addEventListener("orientationchange", refreshScale);
window.addEventListener("resize", refreshScale);
window.visualViewport?.addEventListener("resize", refreshScale);
