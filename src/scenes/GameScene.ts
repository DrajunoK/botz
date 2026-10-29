import Phaser from "phaser";
import { AIM_DURATION_MS, TEAM_LABEL, TeamId } from "@/config/game";
import { ALARM } from "@/config/alarmClock";
import { CLOCK_RADIUS, FIXED_TIMESTEP_MS, MAX_SHOT_SPEED, MAX_STEPS_PER_FRAME } from "@/config/physics";
import { DEBRIS, REPAIR_ON_GOAL } from "@/config/parts";
import { SceneKeys } from "./keys";
import { MatchConfig, newSeed } from "@/game/MatchConfig";
import { GameMode } from "@/game/modes/GameMode";
import { SoccerMode } from "@/game/modes/SoccerMode";
import { GAME_INFO, GameId } from "@/config/tournament";
import { botKey } from "@/game/Tournament";
import { TurnManager, ShotVector } from "@/game/TurnManager";
import { AIController, AIContext } from "@/game/AIController";
import { AimController } from "@/game/AimController";
import { DamageSystem } from "@/game/DamageSystem";
import { PanicTracker, panicConfig } from "@/game/Panic";
import { Rng } from "@/game/Rng";
import { Bot } from "@/game/entities/Bot";
import { AlarmClock } from "@/game/entities/AlarmClock";
import { DebrisField } from "@/game/entities/Debris";
import { HUD } from "@/ui/HUD";
import { createPauseOverlay, createHandoffOverlay, playGoalFlash, playImpactBurst, playPartLostBurst } from "@/ui/Overlays";
import { SFX } from "@/game/Audio";
import type { ResultData } from "./ResultScene";
import type { RankingData } from "./RankingScene";

interface ImpactRecord {
  a: MatterJS.BodyType;
  b: MatterJS.BodyType;
  /** Closing speed along the contact normal (px/step), measured before the solver ran. */
  speed: number;
}

function createMode(game: GameId): GameMode {
  switch (game) {
    case "soccer":
      return new SoccerMode();
    default:
      throw new Error(`Game "${game}" is not implemented yet`);
  }
}

const WALL_LABEL = "wall";
const CLOCK_LABEL = "alarm";

export class GameScene extends Phaser.Scene {
  private matchConfig!: MatchConfig;
  private mode!: GameMode;
  private turnManager!: TurnManager;
  private panic!: PanicTracker;
  private damage!: DamageSystem;
  private debris!: DebrisField;
  private rngShots!: Rng;
  private rngSteer!: Rng;
  private rngAI!: Rng;

  private redBots: Bot[] = [];
  private yellowBots: Bot[] = [];
  private clock!: AlarmClock;
  private redController?: AimController;
  private yellowController?: AimController;
  private hud!: HUD;

  private pauseOverlay?: Phaser.GameObjects.Container;
  private handoffOverlay?: Phaser.GameObjects.Container;
  private isPaused = false;
  private passPlayStage: TeamId = "red";
  private localStageRemainingMs = AIM_DURATION_MS;

  /** Fixed-step simulation clock, ms. Drives cooldowns, stun and the clock's run time. */
  private simTimeMs = 0;
  private stepAccumulatorMs = 0;
  private ringTimerMs = 0;
  private firstAimPhase = true;
  private impacts: ImpactRecord[] = [];

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: MatchConfig): void {
    this.matchConfig = data;
    this.isPaused = false;
    this.pauseOverlay = undefined;
    this.handoffOverlay = undefined;
    this.passPlayStage = "red";
    this.simTimeMs = 0;
    this.stepAccumulatorMs = 0;
    this.ringTimerMs = 0;
    this.firstAimPhase = true;
    this.impacts = [];
    this.redBots = [];
    this.yellowBots = [];
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.redController?.destroy();
      this.yellowController?.destroy();
    });

    // We step Matter ourselves with a fixed timestep (see update()).
    this.matter.world.autoUpdate = false;

    const root = new Rng(this.matchConfig.seed);
    this.rngShots = root.fork();
    this.rngSteer = root.fork();
    this.rngAI = root.fork();
    this.damage = new DamageSystem(root.fork());
    this.debris = new DebrisField(this, root.fork());
    this.panic = new PanicTracker();

    this.mode = createMode(this.matchConfig.gameId);
    this.mode.buildField(this);

    this.redBots = this.mode.botSpawns("red").map((p, i) => new Bot(this, "red", i, p.x, p.y));
    this.yellowBots = this.mode.botSpawns("yellow").map((p, i) => new Bot(this, "yellow", i, p.x, p.y));
    this.restoreCarriedParts();
    for (const b of this.allBots()) this.damage.register(b.uid, b.parts);
    const clockPos = this.mode.clockSpawn();
    this.clock = new AlarmClock(this, clockPos.x, clockPos.y);

    this.turnManager = new TurnManager({ goalsToWin: this.mode.goalsToWin, minResolveMs: ALARM.runDurationMs });
    this.turnManager.on("resolve", (shots: ShotVector[]) => this.handleResolve(shots));
    this.turnManager.on("goal", (team: TeamId) => this.handleGoal(team));
    // The constructor starts in AIMING without emitting the event, so every *subsequent* AIMING
    // phase (after a non-scoring resolution, or after a goal reset via resumeAfterGoal) is driven by
    // this listener; the very first one is kicked off by the explicit beginAimPhase() call below.
    this.turnManager.on("aimPhaseStarted", () => this.beginAimPhase());

    this.hud = new HUD(
      this,
      () => this.handleGoPressed(),
      () => this.openPause(),
    );
    this.hud.setScore(this.turnManager.score);
    this.hud.setGameLabel(this.gameLabel());

    this.redController = new AimController(this, this.turnManager, this.redBots);
    this.redController.onAimChange = () => this.refreshBanner();
    if (this.matchConfig.mode === "passPlay") {
      this.yellowController = new AimController(this, this.turnManager, this.yellowBots);
      this.yellowController.onAimChange = () => this.refreshBanner();
    }

    this.matter.world.on("collisionstart", (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) this.recordImpact(pair);
    });

    this.beginAimPhase();
  }

  /** "Jeu 1/3 · Foot" inside a tournament, just "Foot" in free play. */
  private gameLabel(): string {
    const { tournament, gameId } = this.matchConfig;
    const name = GAME_INFO[gameId].name;
    return tournament ? `Jeu ${tournament.gameIndex + 1}/${tournament.games.length} · ${name}` : name;
  }

  /** Without a workshop stop between games, botz start with the parts they ended the last game with. */
  private restoreCarriedParts(): void {
    const tournament = this.matchConfig.tournament;
    if (!tournament) return;
    for (const b of this.allBots()) {
      const kept = tournament.startingParts(b.team, b.index);
      if (!kept) continue;
      for (const part of b.parts.remaining) if (!kept.includes(part)) b.parts.lose(part);
      b.onPartLost("antenna"); // refreshes mass and art from the new part set
    }
  }

  private allBots(): Bot[] {
    return [...this.redBots, ...this.yellowBots];
  }

  private findBot(uid: number): Bot | undefined {
    return this.allBots().find((b) => b.uid === uid);
  }

  private botOf(body: MatterJS.BodyType): Bot | undefined {
    const uid = (body as unknown as { botUid?: number }).botUid;
    return uid === undefined ? undefined : this.findBot(uid);
  }

  // ───────────────────────────── turn flow ─────────────────────────────

  private beginAimPhase(): void {
    if (this.firstAimPhase) this.firstAimPhase = false;
    else this.panic.advance();

    this.clock.stopRun();
    this.clock.setLevel(this.panic.level);
    this.hud.setPanic(this.panic.level);

    this.redController?.resetVisuals();
    this.yellowController?.resetVisuals();
    this.hud.setGoVisible(true);
    this.hud.setTimerVisible(true);

    if (this.matchConfig.mode === "solo") {
      this.submitAIShots();
    } else {
      this.passPlayStage = "red";
      this.activatePassPlayStage("red");
    }
    this.refreshControllerState();
    this.refreshBanner();
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
    this.refreshBanner();
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

  /** Bottom-left hint: who is aiming and how many of their botz have an arrow. */
  private refreshBanner(): void {
    if (this.turnManager.phase !== "AIMING") {
      this.hud.setBanner(null, "", "");
      return;
    }
    const team: TeamId = this.matchConfig.mode === "solo" ? "red" : this.passPlayStage;
    const bots = team === "red" ? this.redBots : this.yellowBots;
    const ready = bots.filter((b) => b.hasAim).length;
    const name = this.matchConfig.mode === "solo" ? "À toi" : `Joueur ${TEAM_LABEL[team].toLowerCase()}`;
    this.hud.setBanner(team, name, `· glisse depuis un botz pour viser · ${ready}/${bots.length} prêts`);
  }

  private submitAIShots(): void {
    const toState = (b: Bot) => ({ uid: b.uid, index: b.index, x: b.position.x, y: b.position.y });
    const ctx: AIContext = {
      team: "yellow",
      bots: this.yellowBots.map(toState),
      opponentBots: this.redBots.map(toState),
      clock: this.clock.position,
      ownGoal: this.mode.goalCenterFor("yellow"),
      opponentGoal: this.mode.goalCenterFor("red"),
      difficulty: this.matchConfig.difficulty,
      turnNumber: this.turnManager.turnNumber,
      panicLevel: this.panic.level,
      rng: () => this.rngAI.next(),
    };
    for (const s of AIController.computeShots(ctx)) this.turnManager.setAim(s.botUid, s.vx, s.vy);
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
      this.hud.setBanner(null, "", "");
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
      this.findBot(shot.botUid)?.applyShot(shot.vx, shot.vy, this.rngShots);
    }
    this.clock.startRun(this.simTimeMs, this.panic.level);
    this.ringTimerMs = 0;

    this.redController?.setEnabled(false);
    this.yellowController?.setEnabled(false);
    // Arrows are only meaningful during aiming — clear them the instant resolution starts.
    this.redController?.resetVisuals();
    this.yellowController?.resetVisuals();
    this.hud.setGoVisible(false);
    this.hud.setTimerVisible(false);
    this.hud.setBanner(null, "", "");
  }

  // ───────────────────────────── collisions ─────────────────────────────

  /** Called from inside the physics step: only records, effects run right after the step. */
  private recordImpact(pair: Phaser.Types.Physics.Matter.MatterCollisionPair): void {
    const a = pair.bodyA;
    const b = pair.bodyB;
    const rvx = a.velocity.x - b.velocity.x;
    const rvy = a.velocity.y - b.velocity.y;
    const normal = (pair as unknown as { collision?: { normal?: { x: number; y: number } } }).collision?.normal;
    const speed = normal ? Math.abs(rvx * normal.x + rvy * normal.y) : Math.hypot(rvx, rvy);
    this.impacts.push({ a, b, speed });
  }

  private processImpacts(): void {
    const impacts = this.impacts;
    this.impacts = [];
    // Only the resolution phase counts: no part loss or stun while aiming / celebrating.
    const live = this.turnManager.phase === "RESOLVING";
    for (const { a, b, speed } of impacts) {
      const botA = this.botOf(a);
      const botB = this.botOf(b);
      const isWall = a.label === WALL_LABEL || b.label === WALL_LABEL;
      const isClock = a.label === CLOCK_LABEL || b.label === CLOCK_LABEL;

      // Twist 1: hard bot–bot and bot–wall hits knock parts off.
      if (live && !isClock) {
        if (botA && (botB || isWall)) this.tryLosePart(botA, speed);
        if (botB && (botA || isWall)) this.tryLosePart(botB, speed);
      }

      // Twist 2: a bot slamming into the clock stuns it.
      if (live && isClock && (botA || botB) && speed >= ALARM.stunImpactSpeed && !this.clock.isStunned(this.simTimeMs)) {
        this.clock.stun(this.simTimeMs);
        SFX.playStun();
      }

      const intensity = Phaser.Math.Clamp(speed / MAX_SHOT_SPEED, 0, 1);
      if (intensity >= 0.12) {
        SFX.playImpact(intensity);
        const x = (a.position.x + b.position.x) / 2;
        const y = (a.position.y + b.position.y) / 2;
        if (intensity >= 0.3) playImpactBurst(this, x, y, intensity);
        if (intensity > 0.55) this.cameras.main.shake(70, 0.0015 * intensity);
      }
    }
  }

  private tryLosePart(bot: Bot, speed: number): void {
    const lost = this.damage.onImpact(bot.uid, speed, this.simTimeMs);
    if (!lost) return;
    bot.onPartLost(lost);
    const { x, y } = bot.position;
    this.debris.spawn(lost, x, y);
    playPartLostBurst(this, x, y);
    SFX.playClonk();
  }

  // ───────────────────────────── goals ─────────────────────────────

  private handleGoal(team: TeamId): void {
    this.hud.setScore(this.turnManager.score);
    this.panic.onGoal();
    SFX.playGoal();
    playGoalFlash(this, team, this.clock.position.x, this.clock.position.y);

    this.time.delayedCall(1100, () => {
      if (this.turnManager.phase === "GAME_OVER") {
        const score = { ...this.turnManager.score };
        const { tournament, gameId } = this.matchConfig;
        if (tournament) {
          const partsAfter = Object.fromEntries(this.allBots().map((b) => [botKey(b.team, b.index), b.parts.remaining]));
          tournament.record({ game: gameId, winner: team, score }, partsAfter);
          const data: RankingData = { matchConfig: this.matchConfig, tournament };
          this.scene.start(SceneKeys.Ranking, data);
          return;
        }
        const data: ResultData = {
          winner: team,
          score,
          matchConfig: this.matchConfig,
          botState: this.allBots().map((b) => ({ team: b.team, index: b.index, parts: b.parts.remaining })),
        };
        this.scene.start(SceneKeys.Result, data);
        return;
      }
      this.resetKickoff();
      this.turnManager.resumeAfterGoal(); // emits "aimPhaseStarted" -> beginAimPhase()
    });
  }

  private resetKickoff(): void {
    const redPos = this.mode.botSpawns("red");
    const yellowPos = this.mode.botSpawns("yellow");
    this.redBots.forEach((b, i) => b.placeAt(redPos[i].x, redPos[i].y));
    this.yellowBots.forEach((b, i) => b.placeAt(yellowPos[i].x, yellowPos[i].y));
    const clockPos = this.mode.clockSpawn();
    this.clock.placeAt(clockPos.x, clockPos.y);

    if (REPAIR_ON_GOAL) for (const b of this.allBots()) b.repair();
    if (DEBRIS.clearOnGoal) this.debris.clear();
  }

  // ───────────────────────────── pause ─────────────────────────────

  private openPause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseOverlay = createPauseOverlay(this, {
      onResume: () => this.closePause(),
      onRestart: () => {
        this.pauseOverlay?.destroy();
        this.pauseOverlay = undefined;
        this.isPaused = false;
        this.scene.restart({ ...this.matchConfig, seed: newSeed() });
      },
      onQuit: () => this.scene.start(SceneKeys.Menu),
    });
  }

  private closePause(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
    this.isPaused = false;
    this.refreshControllerState();
  }

  // ───────────────────────────── main loop ─────────────────────────────

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.syncVisuals(dt);

    if (this.isPaused || this.handoffOverlay) return;

    const isPassPlayRedStage =
      this.matchConfig.mode === "passPlay" && this.turnManager.phase === "AIMING" && this.passPlayStage === "red";

    if (isPassPlayRedStage) {
      this.localStageRemainingMs = Math.max(0, this.localStageRemainingMs - dt);
      this.hud.setAimTimer(this.localStageRemainingMs, AIM_DURATION_MS);
      if (this.localStageRemainingMs <= 0) this.advancePassPlayStage();
      return;
    }

    if (this.turnManager.phase === "AIMING") {
      this.turnManager.update(dt, []);
      if (this.turnManager.phase === "AIMING") this.hud.setAimTimer(this.turnManager.aimTimeRemainingMs, AIM_DURATION_MS);
    }

    // Fixed-step physics: same simulation whatever the display's refresh rate.
    this.stepAccumulatorMs += dt;
    let steps = 0;
    while (this.stepAccumulatorMs >= FIXED_TIMESTEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.stepAccumulatorMs -= FIXED_TIMESTEP_MS;
      steps += 1;
      this.stepSimulation();
    }
    if (steps === MAX_STEPS_PER_FRAME) this.stepAccumulatorMs = 0;
  }

  private stepSimulation(): void {
    const resolving = this.turnManager.phase === "RESOLVING";

    if (resolving) {
      for (const b of this.allBots()) b.stepMotion(this.rngShots);
      this.clock.step(this.simTimeMs, this.allBots().map((b) => b.position), this.mode.fieldRect, this.rngSteer);
      this.tickRing();
    }

    this.matter.world.step(FIXED_TIMESTEP_MS);
    this.simTimeMs += FIXED_TIMESTEP_MS;
    this.processImpacts();

    if (this.turnManager.phase !== "RESOLVING") return;

    const { x, y } = this.clock.position;
    const scoring = this.mode.checkScore(x, y, CLOCK_RADIUS);
    if (scoring) {
      this.turnManager.reportGoal(scoring);
      return;
    }

    const speeds = [...this.allBots().map((b) => b.speed), this.clock.speed, ...this.debris.speeds()];
    this.turnManager.update(FIXED_TIMESTEP_MS, speeds);
  }

  /** Alarm bell SFX while the clock is awake and running. */
  private tickRing(): void {
    if (!this.clock.isRunning(this.simTimeMs)) return;
    this.ringTimerMs -= FIXED_TIMESTEP_MS;
    if (this.ringTimerMs <= 0) {
      this.ringTimerMs = panicConfig(this.clock.level).ringPeriodMs;
      SFX.playRing(this.clock.level);
    }
  }

  private syncVisuals(dtMs: number): void {
    const t = this.time.now / 1000;
    for (const b of this.allBots()) b.syncVisuals(t);
    this.clock.syncVisuals(this.simTimeMs, dtMs / 1000);
    this.debris.syncVisuals();
  }
}
