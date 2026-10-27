import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/game";
import { GRAVITY } from "@/config/physics";
import { BootScene } from "@/scenes/BootScene";
import { MenuScene } from "@/scenes/MenuScene";
import { GameScene } from "@/scenes/GameScene";
import { ResultScene } from "@/scenes/ResultScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0d1117",
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
      // Fixed 60Hz physics step (see src/config/physics.ts) for reproducible
      // simulation across devices/framerates.
      runner: { fps: 60 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
};

new Phaser.Game(config);
