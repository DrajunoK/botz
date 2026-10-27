import Phaser from "phaser";
import { AIM_DURATION_MS, TeamId } from "@/config/game";
import { BALL_RADIUS, MAX_SHOT_SPEED } from "@/config/physics";
import { SceneKeys } from "./keys";
import { MatchConfig } from "@/game/MatchConfig";
import { GameMode } from "@/game/modes/GameMode";
import { SoccerMode } from "@/game/modes/SoccerMode";
import { TurnManager, ShotVector } from "@/game/TurnManager";
import { AIController, AIContext } from "@/game/AIController";
import { AimController } from "@/game/AimController";
import { Bot } from "@/game/entities/Bot";
import { Ball } from "@/game/entities/Ball";
import { HUD } from "@/ui/HUD";
import { createPauseOverlay, createHandoffOverlay, playGoalFlash, playImpactBurst } from "@/ui/Overlays";
import { SFX } from "@/game/Audio";

export class GameScene extends Phaser.Scene {
  private matchConfig!: MatchConfig;
  private mode!: GameMode;
  private turnManager!: TurnManager;
  private redBots: Bot[] = [];
  private yellowBots: Bot[] = [];
  private ball!: Ball;
  private redController?: AimController;
  private yellowController?: AimController;
  private hud!: HUD;

  private pauseOverlay?: Phaser.GameObjects.Container;
  private handoffOverlay?: Phaser.GameObjects.Container;
  private isPaused = false;
  private passPlayStage: TeamId = "red";
  private localStageRemainingMs = AIM_DURATION_MS;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: MatchConfig): void {
    this.matchConfig = data;
    this.isPaused = false;
    this.pauseOverlay = undefined;
    this.handoffOverlay = undefined;
    this.passPlayStage = "red";
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.redController?.destroy();
      this.yellowController?.destroy();
    });

    this.mode = new SoccerMode();
    this.mode.buildField(this);

    this.redBots = this.mode.botSpawns("red").map((p, i) => new Bot(this, "red", i, p.x, p.y));
    this.yellowBots = this.mode.botSpawns("yellow").map((p, i) => new Bot(this, "yellow", i, p.x, p.y));
    const ballPos = this.mode.ballSpawn();
    this.ball = new Ball(this, ballPos.x, ballPos.y);

    this.turnManager = new TurnManager({ goalsToWin: this.mode.goalsToWin });
    this.turnManager.on("resolve", (shots: ShotVector[]) => this.handleResolve(shots));
    this.turnManager.on("goal", (team: TeamId) => this.handleGoal(team));
    // The constructor starts in AIMING without emitting the event, so every
    // *subsequent* AIMING phase (after a non-scoring resolution, or after a
    // goal reset via resumeAfterGoal) is driven by this listener; the very
    // first one is kicked off by the explicit beginAimPhase() call below.
    this.turnManager.on("aimPhaseStarted", () => this.beginAimPhase());

    this.hud = new HUD(
      this,
      () => this.handleGoPressed(),
      () => this.openPause(),
    );
    this.hud.setScore(this.turnManager.score);

    this.redController = new AimController(this, this.turnManager, this.redBots);
    if (this.matchConfig.mode === "passPlay") {
      this.yellowController = new AimController(this, this.turnManager, this.yellowBots);
    }

    this.matter.world.on(
      "collisionstart",
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        for (const pair of event.pairs) this.handleCollision(pair);
      },
    );

    this.beginAimPhase();
  }

  private allBots(): Bot[] {
    return [...this.redBots, ...this.yellowBots];
  }

  private findBot(uid: number): Bot | undefined {
    return this.allBots().find((b) => b.uid === uid);
  }

  private beginAimPhase(): void {
    this.redController?.resetVisuals();
    this.yellowController?.resetVisuals();
    this.hud.setGoVisible(true);
    this.hud.setTimerVisible(true);

    if (this.matchConfig.mode === "solo") {
      this.hud.setTurnLabel("");
      this.submitAIShots();
    } else {
      this.passPlayStage = "red";
      this.activatePassPlayStage("red");
    }
    this.refreshControllerState();
  }

  private activatePassPlayStage(team: TeamId): void {
    const active = team === "red" ? this.redController : this.yellowController;
    const other = team === "red" ? this.yellowController : this.redController;
    active?.setEnabled(true);
    active?.setVisible(true);
    other?.setEnabled(false);
    other?.setVisible(false);

    if (team === "red") {
      this.localStageRemainingMs = AIM_DURATION_MS;
    } else {
      this.turnManager.resetAimTimer();
    }

    this.hud.setTurnLabel(`Tour : ${team === "red" ? "ROUGE" : "JAUNE"}`);
    this.hud.setTurnColor(team);
  }

  private refreshControllerState(): void {
    if (this.turnManager.phase !== "AIMING") {
      this.redController?.setEnabled(false);
      this.yellowController?.setEnabled(false);
      return;
    }
    if (this.matchConfig.mode === "solo") {
      this.redController?.setEnabled(true);
    } else if (this.passPlayStage === "red") {
      this.redController?.setEnabled(true);
      this.yellowController?.setEnabled(false);
    } else {
      this.redController?.setEnabled(false);
      this.yellowController?.setEnabled(true);
    }
  }

  private submitAIShots(): void {
    const ctx: AIContext = {
      team: "yellow",
      bots: this.yellowBots.map((b) => ({ uid: b.uid, index: b.index, x: b.position.x, y: b.position.y })),
      opponentBots: this.redBots.map((b) => ({ uid: b.uid, index: b.index, x: b.position.x, y: b.position.y })),
      ball: { x: this.ball.position.x, y: this.ball.position.y },
      ownGoal: this.mode.goalCenterFor("yellow"),
      opponentGoal: this.mode.goalCenterFor("red"),
      difficulty: this.matchConfig.difficulty,
      turnNumber: this.turnManager.turnNumber,
    };
    const shots = AIController.computeShots(ctx);
    for (const s of shots) this.turnManager.setAim(s.botUid, s.vx, s.vy);
    this.turnManager.setTeamReady("yellow");
  }

  private handleGoPressed(): void {
    if (this.turnManager.phase !== "AIMING") return;
    if (this.matchConfig.mode === "solo") {
      this.turnManager.setTeamReady("red");
    } else {
      this.advancePassPlayStage();
    }
  }

  private advancePassPlayStage(): void {
    if (this.passPlayStage === "red") {
      this.turnManager.setTeamReady("red");
      this.redController?.setEnabled(false);
      this.hud.setGoVisible(false);
      this.handoffOverlay = createHandoffOverlay(this, "yellow", () => {
        this.handoffOverlay?.destroy();
        this.handoffOverlay = undefined;
        this.passPlayStage = "yellow";
        this.activatePassPlayStage("yellow");
        this.hud.setGoVisible(true);
        this.refreshControllerState();
      });
    } else {
      this.turnManager.setTeamReady("yellow");
    }
  }

  private handleResolve(shots: ShotVector[]): void {
    for (const shot of shots) {
      this.findBot(shot.botUid)?.applyShotVelocity(shot.vx, shot.vy);
    }
    this.redController?.setEnabled(false);
    this.yellowController?.setEnabled(false);
    // Arrows are only meaningful during aiming — clear them the instant
    // resolution starts instead of leaving them on screen through the shot.
    this.redController?.resetVisuals();
    this.yellowController?.resetVisuals();
    this.hud.setGoVisible(false);
    this.hud.setTimerVisible(false);
    this.hud.setTurnLabel("");
  }

  private handleCollision(pair: Phaser.Types.Physics.Matter.MatterCollisionPair): void {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;
    const relVx = bodyA.velocity.x - bodyB.velocity.x;
    const relVy = bodyA.velocity.y - bodyB.velocity.y;
    const intensity = Phaser.Math.Clamp(Math.hypot(relVx, relVy) / MAX_SHOT_SPEED, 0, 1);
    if (intensity < 0.08) return;

    SFX.playImpact(intensity);
    const x = (bodyA.position.x + bodyB.position.x) / 2;
    const y = (bodyA.position.y + bodyB.position.y) / 2;
    playImpactBurst(this, x, y, intensity);
    if (intensity > 0.55) {
      this.cameras.main.shake(70, 0.0015 * intensity);
    }
  }

  private handleGoal(team: TeamId): void {
    this.hud.setScore(this.turnManager.score);
    SFX.playGoal();
    playGoalFlash(this, team, this.ball.position.x, this.ball.position.y);

    this.time.delayedCall(900, () => {
      if (this.turnManager.phase === "GAME_OVER") {
        this.scene.start(SceneKeys.Result, {
          winner: team,
          score: { ...this.turnManager.score },
          matchConfig: this.matchConfig,
        });
        return;
      }
      this.resetKickoff();
      this.turnManager.resumeAfterGoal(); // emits "aimPhaseStarted" -> beginAimPhase()
    });
  }

  private resetKickoff(): void {
    const redPos = this.mode.botSpawns("red");
    const yellowPos = this.mode.botSpawns("yellow");
    this.redBots.forEach((b, i) => this.placeBot(b, redPos[i].x, redPos[i].y));
    this.yellowBots.forEach((b, i) => this.placeBot(b, yellowPos[i].x, yellowPos[i].y));
    const ballPos = this.mode.ballSpawn();
    this.ball.setPosition(ballPos.x, ballPos.y);
  }

  private placeBot(bot: Bot, x: number, y: number): void {
    bot.gameObject.setPosition(x, y);
    bot.gameObject.setVelocity(0, 0);
    bot.gameObject.setAngularVelocity(0);
  }

  private openPause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.matter.world.pause();
    this.pauseOverlay = createPauseOverlay(this, {
      onResume: () => this.closePause(),
      onRestart: () => {
        this.pauseOverlay?.destroy();
        this.pauseOverlay = undefined;
        this.isPaused = false;
        this.matter.world.resume();
        this.scene.restart(this.matchConfig);
      },
      onQuit: () => this.scene.start(SceneKeys.Menu),
    });
  }

  private closePause(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
    this.isPaused = false;
    this.matter.world.resume();
    this.refreshControllerState();
  }

  update(_time: number, delta: number): void {
    for (const b of this.allBots()) b.syncVisuals();
    this.ball.syncVisuals();

    if (this.isPaused || this.handoffOverlay) return;

    const isPassPlayRedStage =
      this.matchConfig.mode === "passPlay" &&
      this.turnManager.phase === "AIMING" &&
      this.passPlayStage === "red";

    if (isPassPlayRedStage) {
      this.localStageRemainingMs = Math.max(0, this.localStageRemainingMs - delta);
      this.hud.setAimTimer(this.localStageRemainingMs, AIM_DURATION_MS);
      if (this.localStageRemainingMs <= 0) this.advancePassPlayStage();
      return;
    }

    const speeds = this.allBots()
      .map((b) => b.speed)
      .concat([this.ball.speed]);
    this.turnManager.update(delta, speeds);

    if (this.turnManager.phase === "AIMING") {
      this.hud.setAimTimer(this.turnManager.aimTimeRemainingMs, AIM_DURATION_MS);
    }

    if (this.turnManager.phase === "RESOLVING") {
      const scoring = this.mode.checkScore(this.ball.position.x, this.ball.position.y, BALL_RADIUS);
      if (scoring) this.turnManager.reportGoal(scoring);
    }
  }
}
