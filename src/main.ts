import Phaser from "phaser";
import "./styles.css";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/game";
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
    width: GAME_WIDTH,
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

new Phaser.Game(config);
