import Phaser from "phaser";
import { AIM_DURATION_MS, GAME_WIDTH, ONLINE_AIM_DURATION_MS, TEAM_LABEL, TeamId } from "@/config/game";
import { ALARM } from "@/config/alarmClock";
import { CLOCK_RADIUS, FIXED_TIMESTEP_MS, MAX_SHOT_SPEED, MAX_STEPS_PER_FRAME } from "@/config/physics";
import { DEBRIS, REPAIR_ON_GOAL } from "@/config/parts";
import { SceneKeys } from "./keys";
import { MatchConfig, newSeed } from "@/game/MatchConfig";
import { GameMode, ModeContext } from "@/game/modes/GameMode";
import { SoccerMode } from "@/game/modes/SoccerMode";
import { SurvivorMode } from "@/game/modes/SurvivorMode";
import { PetanqueMode } from "@/game/modes/PetanqueMode";
import { GAME_INFO, GameId } from "@/config/tournament";
import { botKey } from "@/game/Tournament";
import { Stats, statsMode } from "@/state/stats";
import { Body } from "@/game/util/matter";
import { syncStats } from "@/net/cloud";
import { TurnManager, ShotVector } from "@/game/TurnManager";
import { AIController, AIContext, AIShot } from "@/game/AIController";
import { AimController } from "@/game/AimController";
import { DamageSystem } from "@/game/DamageSystem";
import { PanicTracker, panicConfig } from "@/game/Panic";
import { Rng } from "@/game/Rng";
import { Bot } from "@/game/entities/Bot";
import { AlarmClock } from "@/game/entities/AlarmClock";
import { DebrisField } from "@/game/entities/Debris";
import { HUD } from "@/ui/HUD";
import { COLORS } from "@/config/theme";
import { bodyText, hex } from "@/ui/ui";
import { createPauseOverlay, createHandoffOverlay, playGoalFlash, playImpactBurst, playPartLostBurst } from "@/ui/Overlays";
import { SFX } from "@/game/Audio";
import type { ResultData } from "./ResultScene";
import type { RankingData } from "./RankingScene";
import { centerOnDesignArea } from "@/ui/viewport";
import { hashNumbers } from "@/game/syncTest";
import type { OnlineSession, PeerLeftReason } from "@/net/OnlineSession";

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
    case "survivor":
      return new SurvivorMode();
    case "petanque":
      return new PetanqueMode();
    default:
      throw new Error(`Game "${game}" is not implemented yet`);
  }
}

/** Our shots are locked and the opponent has said nothing for this long: they are gone. */
const ONLINE_PEER_SILENCE_MS = 40_000;

const WORLD_VALUES_PER_BODY = 9;

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
  private rngMode!: Rng;

  private redBots: Bot[] = [];
  private yellowBots: Bot[] = [];
  /** Only exists in modes played with the alarm clock (see GameMode.clock). */
  private clock?: AlarmClock;
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
  /** Determinism check: one line per finished turn (see game/syncTest.ts). */
  private syncLines: string[] = [];
  private syncReport?: Phaser.GameObjects.Text;

  // Online match (see net/OnlineSession.ts). Both devices simulate the same match; only shots travel.
  private online?: OnlineSession;
  private localTeam: TeamId = "red";
  private onlineAimMs = ONLINE_AIM_DURATION_MS;
  private onlineLocked = false;
  private onlinePeerShotsApplied = false;
  private onlineWaitedMs = 0;
  /** Guest: our world at the end of the last turn, waiting to be compared with the host's. */
  private onlineMine?: { turn: number; values: number[]; epoch: number; checked: boolean };
  /** Bumped whenever the world is moved on purpose (resolution starts, kickoff reset): a snapshot only applies within one epoch. */
  private worldEpoch = 0;
  private onlineEnded = false;
  private onlineToast?: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: MatchConfig): void {
    this.matchConfig = data;
    this.isPaused = false;
    this.lastStanding = "";
    this.pauseOverlay = undefined;
    this.handoffOverlay = undefined;
    this.passPlayStage = "red";
    this.simTimeMs = 0;
    this.stepAccumulatorMs = 0;
    this.ringTimerMs = 0;
    this.firstAimPhase = true;
    this.impacts = [];
    this.syncLines = [];
    this.syncReport = undefined;
    this.online = data.online;
    this.localTeam = data.online?.team ?? "red";
    this.onlineLocked = false;
    this.onlinePeerShotsApplied = false;
    this.onlineWaitedMs = 0;
    this.onlineMine = undefined;
    this.worldEpoch = 0;
    this.onlineEnded = false;
    this.onlineToast = undefined;
    this.redBots = [];
    this.yellowBots = [];
  }

  create(): void {
    centerOnDesignArea(this);
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
    this.rngMode = root.fork(); // forked last so the other generators keep their sequences
    this.panic = new PanicTracker();

    this.mode = createMode(this.matchConfig.gameId);
    this.mode.buildField(this);

    this.redBots = this.mode.botSpawns("red").map((p, i) => new Bot(this, "red", i, p.x, p.y));
    this.yellowBots = this.mode.botSpawns("yellow").map((p, i) => new Bot(this, "yellow", i, p.x, p.y));
    this.restoreCarriedParts();
    for (const b of this.allBots()) this.damage.register(b.uid, b.parts);
    const clockRules = this.mode.clock;
    if (clockRules) {
      const clockPos = clockRules.spawn();
      this.clock = new AlarmClock(this, clockPos.x, clockPos.y);
    }

    this.turnManager = new TurnManager({
      goalsToWin: this.mode.goalsToWin,
      minResolveMs: this.mode.clock ? ALARM.runDurationMs : 0,
      aimDurationMs: this.online ? ONLINE_AIM_DURATION_MS : undefined,
    });
    this.turnManager.on("resolve", (shots: ShotVector[]) => this.handleResolve(shots));
    this.turnManager.on("goal", (team: TeamId) => this.handleGoal(team));
    this.turnManager.on("settled", () => this.handleSettled());
    // The constructor starts in AIMING without emitting the event, so every *subsequent* AIMING
    // phase (after a non-scoring resolution, or after a goal reset via resumeAfterGoal) is driven by
    // this listener; the very first one is kicked off by the explicit beginAimPhase() call below.
    this.turnManager.on("aimPhaseStarted", () => this.beginAimPhase());

    this.hud = new HUD(
      this,
      () => this.handleGoPressed(),
      () => this.openPause(),
    );
    this.hud.configure(this.mode.hud);
    this.hud.setScore(this.turnManager.score);
    this.hud.setGameLabel(this.gameLabel());
    this.refreshStanding();

    const makeController = (bots: Bot[]): AimController => {
      const controller = new AimController(this, this.turnManager, bots);
      controller.canAim = (b) => this.isAimable(b);
      controller.onAimChange = () => this.refreshBanner();
      return controller;
    };
    // Online, this device only ever aims its own team.
    if (!this.online || this.localTeam === "red") this.redController = makeController(this.redBots);
    if (this.matchConfig.mode === "passPlay" || (this.online && this.localTeam === "yellow")) {
      this.yellowController = makeController(this.yellowBots);
    }
    if (this.online) this.watchOpponent(this.online);

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

  /** Botz still in play (modes like Survivant eliminate some). */
  private aliveBots(): Bot[] {
    return this.allBots().filter((b) => !b.eliminated);
  }

  /** A bot the player may aim this turn: in play, and allowed by the mode (one thrower per turn in Pétanque). */
  private isAimable(bot: Bot): boolean {
    return !bot.eliminated && (this.mode.canAim?.(bot) ?? true);
  }

  private modeContext(): ModeContext {
    return { scene: this, bots: this.allBots(), debris: this.debris, rng: this.rngMode };
  }

  private lastStanding = "";

  /** Redraws the botz-still-standing icons when (and only when) someone fell. */
  private refreshStanding(): void {
    if (!this.mode.hud.standings) return;
    const red = this.redBots.map((b) => !b.eliminated);
    const yellow = this.yellowBots.map((b) => !b.eliminated);
    const key = [...red, ...yellow].join();
    if (key === this.lastStanding) return;
    this.lastStanding = key;
    this.hud.setStanding(red, yellow);
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

    this.clock?.stopRun();
    this.clock?.setLevel(this.panic.level);
    this.hud.setPanic(this.panic.level);

    this.mode.onAimPhase?.(this.modeContext(), this.turnManager.turnNumber);
    this.refreshStanding();
    const notice = this.mode.notice?.(this.turnManager.turnNumber);
    this.hud.setNotice(notice?.text ?? null, notice?.warning ?? false);
    this.syncScore();
    // A shrinking arena can end the game before anyone aims.
    if (this.checkModeWinner()) return;

    this.redController?.resetVisuals();
    this.yellowController?.resetVisuals();
    this.hud.setGoVisible(true);
    this.hud.setTimerVisible(true);

    if (this.matchConfig.syncTest) {
      this.submitAIShots("red");
      this.submitAIShots("yellow");
    } else if (this.online) {
      this.beginOnlineAim();
    } else if (this.matchConfig.mode === "solo") {
      this.submitAIShots("yellow");
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
    if (this.online) {
      this.localController()?.setEnabled(!this.onlineLocked && !this.isPaused);
    } else if (this.matchConfig.mode === "solo") {
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
    if (this.online) {
      this.refreshOnlineBanner();
      return;
    }
    const team: TeamId = this.matchConfig.mode === "solo" ? "red" : this.passPlayStage;
    const bots = (team === "red" ? this.redBots : this.yellowBots).filter((b) => this.isAimable(b));
    const ready = bots.filter((b) => b.hasAim).length;
    const name = this.matchConfig.mode === "solo" ? "À toi" : `Joueur ${TEAM_LABEL[team].toLowerCase()}`;
    const goal = this.mode.hud.standings ? "pousse les botz adverses dans la lave" : "glisse depuis un botz pour viser";
    this.hud.setBanner(team, name, `· ${goal} · ${ready}/${bots.length} prêts`);
  }

  private submitAIShots(team: TeamId): void {
    for (const s of this.computeAIShots(team)) this.turnManager.setAim(s.botUid, s.vx, s.vy);
    this.turnManager.setTeamReady(team);
  }

  private computeAIShots(team: TeamId): AIShot[] {
    const own = team === "red" ? this.redBots : this.yellowBots;
    const other = team === "red" ? this.yellowBots : this.redBots;
    const toState = (b: Bot) => ({ uid: b.uid, index: b.index, x: b.position.x, y: b.position.y });
    if (this.mode.aiShots) {
      return this.mode.aiShots({
        team,
        bots: own.filter((b) => this.isAimable(b)).map(toState),
        ownBots: own.filter((b) => !b.eliminated).map(toState),
        opponentBots: other.filter((b) => !b.eliminated).map(toState),
        difficulty: this.matchConfig.difficulty,
        rng: () => this.rngAI.next(),
      });
    }
    const clockRules = this.mode.clock;
    // The AI is written per mode; a mode with neither a clock nor its own AI gets no shots.
    if (!clockRules || !this.clock) return [];
    const ctx: AIContext = {
      team,
      bots: own.map(toState),
      opponentBots: other.map(toState),
      clock: this.clock.position,
      ownGoal: clockRules.goalCenterFor(team),
      opponentGoal: clockRules.goalCenterFor(team === "red" ? "yellow" : "red"),
      difficulty: this.matchConfig.difficulty,
      turnNumber: this.turnManager.turnNumber,
      panicLevel: this.panic.level,
      rng: () => this.rngAI.next(),
    };
    return AIController.computeShots(ctx);
  }

  private handleGoPressed(): void {
    if (this.turnManager.phase !== "AIMING") return;
    if (this.online) {
      this.lockOnline();
    } else if (this.matchConfig.mode === "solo") {
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
    this.worldEpoch += 1;
    for (const shot of shots) {
      const bot = this.findBot(shot.botUid);
      const scale = this.mode.shotSpeedScale ?? 1;
      if (bot && !bot.eliminated) bot.applyShot(shot.vx * scale, shot.vy * scale, this.rngShots);
    }
    this.clock?.startRun(this.simTimeMs, this.panic.level);
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
      if (botA?.eliminated || botB?.eliminated) continue; // already falling in the lava
      const isWall = a.label === WALL_LABEL || b.label === WALL_LABEL;
      const isClock = a.label === CLOCK_LABEL || b.label === CLOCK_LABEL;

      // Twist 1: hard bot–bot and bot–wall hits knock parts off.
      if (live && !isClock) {
        if (botA && (botB || isWall)) this.tryLosePart(botA, speed);
        if (botB && (botA || isWall)) this.tryLosePart(botB, speed);
      }

      // Twist 2: a bot slamming into the clock stuns it.
      if (live && isClock && this.clock && (botA || botB) && speed >= ALARM.stunImpactSpeed && !this.clock.isStunned(this.simTimeMs)) {
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
    if (this.recordSyncTurn(`but ${team}`)) return;
    this.shareTurnEnd();
    this.hud.setScore(this.turnManager.score);
    this.panic.onGoal();
    SFX.playGoal();
    if (this.clock) playGoalFlash(this, team, this.clock.position.x, this.clock.position.y);

    this.time.delayedCall(1100, () => {
      if (this.turnManager.phase === "GAME_OVER") {
        this.finishGame(team);
        return;
      }
      this.resetKickoff();
      this.turnManager.resumeAfterGoal(); // emits "aimPhaseStarted" -> beginAimPhase()
    });
  }

  /** Modes decided by something other than a running score (last team standing...) end here. */
  private checkModeWinner(finishDelayMs = 1100): boolean {
    const result = this.mode.checkWinner?.(this.modeContext());
    this.refreshStanding(); // sudden death may have brought botz back
    if (!result) return false;
    this.turnManager.endGame(result.winner, result.score);
    this.hud.setScore(this.turnManager.score);
    this.hud.setNotice(null);
    this.hud.setGoVisible(false);
    this.time.delayedCall(finishDelayMs, () => this.finishGame(result.winner));
    return true;
  }

  /** Shows the mode's own score (Pétanque points) instead of the turn manager's goal count. */
  private syncScore(): void {
    const score = this.mode.score?.();
    if (!score) return;
    this.turnManager.score = score;
    this.hud.setScore(score);
  }

  /** A resolution settled: let the mode score / sweep up, hold the game for its animation if it asks to. */
  private handleSettled(): void {
    if (this.recordSyncTurn("fin de tour")) {
      this.turnManager.pause();
      return;
    }
    this.shareTurnEnd();
    const pause = this.mode.onSettled?.(this.modeContext()) ?? null;
    this.syncScore();
    if (this.checkModeWinner(pause?.pauseMs ?? 1100)) return;
    if (!pause) return;
    this.turnManager.pause();
    this.hud.setNotice(null);
    this.time.delayedCall(pause.pauseMs, () => {
      this.mode.onResume?.(this.modeContext());
      this.turnManager.resumeAfterGoal(); // emits "aimPhaseStarted" -> beginAimPhase()
    });
  }

  /** Hands over to the ranking (tournament) or the result screen (free play). */
  private finishGame(winner: TeamId): void {
    if (this.matchConfig.syncTest) {
      this.showSyncReport(`partie finie (${winner})`);
      return;
    }
    const score = { ...this.turnManager.score };
    const { tournament, gameId } = this.matchConfig;
    this.online?.endMatch();
    this.recordStats(winner, score);
    if (tournament) {
      const partsAfter = Object.fromEntries(this.allBots().map((b) => [botKey(b.team, b.index), b.parts.remaining]));
      tournament.record({ game: gameId, winner, score }, partsAfter);
      const data: RankingData = { matchConfig: this.matchConfig, tournament };
      this.scene.start(SceneKeys.Ranking, data);
      return;
    }
    const data: ResultData = {
      winner,
      score,
      matchConfig: this.matchConfig,
      botState: this.allBots().map((b) => ({ team: b.team, index: b.index, parts: b.parts.remaining })),
    };
    this.scene.start(SceneKeys.Result, data);
  }

  /** Stores the finished game (and the tournament, once its last game ends), then uploads in the background. */
  private recordStats(winner: TeamId, score: Record<TeamId, number>): void {
    const { tournament, gameId, mode } = this.matchConfig;
    Stats.recordGame({ game: gameId, mode: statsMode(mode), tournamentId: tournament?.id, winner, score, player: this.online?.team });
    if (tournament && tournament.gameIndex + 1 >= tournament.games.length) {
      // The ranking screen records the final game on the tournament itself, so decide the winner here.
      const trophies = { ...tournament.trophies };
      trophies[winner] += 1;
      const tournamentWinner = trophies.red === trophies.yellow ? null : trophies.red > trophies.yellow ? "red" : "yellow";
      Stats.recordTournament({ id: tournament.id, mode: statsMode(mode), winner: tournamentWinner });
    }
    void syncStats();
  }

  private resetKickoff(): void {
    this.worldEpoch += 1;
    const redPos = this.mode.botSpawns("red");
    const yellowPos = this.mode.botSpawns("yellow");
    this.redBots.forEach((b, i) => b.placeAt(redPos[i].x, redPos[i].y));
    this.yellowBots.forEach((b, i) => b.placeAt(yellowPos[i].x, yellowPos[i].y));
    const clockPos = this.mode.clock?.spawn();
    if (clockPos) this.clock?.placeAt(clockPos.x, clockPos.y);

    if (REPAIR_ON_GOAL) for (const b of this.allBots()) b.repair();
    if (DEBRIS.clearOnGoal) this.debris.clear();
  }

  // ───────────────────────────── online match ─────────────────────────────

  /** The controller of the team this device plays (online only). */
  private localController(): AimController | undefined {
    return this.localTeam === "red" ? this.redController : this.yellowController;
  }

  private localBots(): Bot[] {
    return this.localTeam === "red" ? this.redBots : this.yellowBots;
  }

  private beginOnlineAim(): void {
    this.onlineLocked = false;
    this.onlinePeerShotsApplied = false;
    this.onlineWaitedMs = 0;
    this.onlineAimMs = ONLINE_AIM_DURATION_MS;
    this.localController()?.setEnabled(true);
    this.localController()?.setVisible(true);
    this.hud.setAimTimer(this.onlineAimMs, ONLINE_AIM_DURATION_MS);
    if (this.matchConfig.onlineAutoplay) {
      for (const s of this.computeAIShots(this.localTeam)) this.turnManager.setAim(s.botUid, s.vx, s.vy);
      // A beat of "thinking", like a person: locking in the same instant would race the end-of-turn sync.
      this.time.delayedCall(400, () => this.lockOnline());
    }
  }

  /** Our shots are final: send them, and wait for the opponent's if they are not here yet. */
  private lockOnline(): void {
    if (!this.online || this.onlineLocked || this.turnManager.phase !== "AIMING") return;
    this.onlineLocked = true;
    const shots = this.localBots().flatMap((b) => {
      const aim = this.turnManager.getAim(b.uid);
      return aim ? [{ index: b.index, vx: aim.vx, vy: aim.vy }] : [];
    });
    this.online.sendAims(this.turnManager.turnNumber, shots);
    this.localController()?.setEnabled(false);
    this.hud.setGoVisible(false);
    this.hud.setTimerVisible(false);
    this.refreshBanner();
    // Starts the resolution right away when the opponent's shots are already in.
    this.turnManager.setTeamReady(this.localTeam);
  }

  /** The opponent's locked-in shots for this turn, once they have arrived. */
  private applyPeerShots(): void {
    if (!this.online || this.onlinePeerShotsApplied || this.turnManager.phase !== "AIMING") return;
    const shots = this.online.peerAims(this.turnManager.turnNumber);
    if (!shots) return;
    this.onlinePeerShotsApplied = true;
    const theirs = this.localTeam === "red" ? this.yellowBots : this.redBots;
    for (const shot of shots) {
      const bot = theirs.find((b) => b.index === shot.index);
      if (bot && !bot.eliminated) this.turnManager.setAim(bot.uid, shot.vx, shot.vy);
    }
    this.refreshBanner();
    this.turnManager.setTeamReady(this.online.opponentTeam);
  }

  /** Every frame of an online aim phase: our own clock, the opponent's shots, and the "gone quiet" check. */
  private onlineTick(dt: number): void {
    this.checkSnapshot();
    if (!this.online || this.turnManager.phase !== "AIMING") return;
    this.applyPeerShots();
    if (this.turnManager.phase !== "AIMING") return;

    if (!this.onlineLocked) {
      this.onlineAimMs = Math.max(0, this.onlineAimMs - dt);
      this.hud.setAimTimer(this.onlineAimMs, ONLINE_AIM_DURATION_MS);
      if (this.onlineAimMs <= 0) this.lockOnline();
    } else if (!this.onlinePeerShotsApplied) {
      this.onlineWaitedMs += dt;
      if (this.onlineWaitedMs > ONLINE_PEER_SILENCE_MS) this.opponentGone("silence");
    }
  }

  private refreshOnlineBanner(): void {
    const peerReady = this.onlinePeerShotsApplied;
    if (this.onlineLocked) {
      this.hud.setBanner(this.localTeam, "Tir validé", "· en attente de l'adversaire…");
      return;
    }
    const bots = this.localBots().filter((b) => this.isAimable(b));
    const ready = bots.filter((b) => b.hasAim).length;
    const goal = this.mode.hud.standings ? "pousse les botz adverses dans la lave" : "glisse depuis un botz pour viser";
    this.hud.setBanner(this.localTeam, "À toi", `· ${goal} · ${ready}/${bots.length} prêts${peerReady ? " · l'adversaire est prêt" : ""}`);
  }

  /**
   * End of a turn: the host publishes its world, the guest keeps its own to compare. Floating point
   * could in theory differ between two browsers; if it ever does, the host's world wins.
   */
  private shareTurnEnd(): void {
    const online = this.online;
    if (!online) return;
    const turn = this.turnManager.turnNumber;
    if (this.matchConfig.onlineDrift && online.role === "guest" && turn === 2) this.injectDrift();
    const values = this.worldValues();
    if (online.role === "host") online.sendSnapshot(turn, values);
    else this.onlineMine = { turn, values, epoch: this.worldEpoch, checked: false };
  }

  /** Guest, every frame: compare the host's end-of-turn world with ours and repair it if it differs. */
  private checkSnapshot(): void {
    const mine = this.onlineMine;
    if (!this.online || !mine || mine.checked) return;
    const theirs = this.online.hostSnapshot(mine.turn);
    if (!theirs) return;
    mine.checked = true;
    const same = theirs.length === mine.values.length && theirs.every((v, i) => v === mine.values[i]);
    if (same) {
      console.debug(`[online] turn ${mine.turn} in sync`);
      return;
    }
    // Nothing has moved since we took our own snapshot (we are aiming): safe to copy the host's world.
    const repaired = mine.epoch === this.worldEpoch && this.applyWorldValues(theirs);
    console.warn(`[online] simulations differ after turn ${mine.turn}${repaired ? ": repaired from the host" : ""}`);
    this.showOnlineToast(repaired ? "Écrans resynchronisés" : "Les deux écrans ne montrent plus la même partie");
    if (repaired) this.time.delayedCall(2000, () => this.showOnlineToast(null));
  }

  /** Test hook (`&drift=1`): moves one body by a hair so the repair path can be exercised. */
  private injectDrift(): void {
    const body = (this.matter.world.getAllBodies() as MatterJS.BodyType[]).find((b) => !b.isStatic);
    if (body) Body.setPosition(body, { x: body.position.x + 0.37, y: body.position.y }, false);
  }

  private watchOpponent(session: OnlineSession): void {
    session.onPeerLeft = (reason) => this.opponentGone(reason);
    session.onPeerAway = () => this.showOnlineToast("Ton adversaire est déconnecté… on l'attend");
    session.onPeerBack = () => this.showOnlineToast(null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.onPeerLeft = undefined;
      session.onPeerAway = undefined;
      session.onPeerBack = undefined;
    });
  }

  /** Leaving an online match that is still going counts as a loss, and tells the opponent right away. */
  private forfeitOnlineMatch(): void {
    const online = this.online;
    if (!online) return;
    if (this.turnManager.phase !== "GAME_OVER") {
      Stats.recordGame({
        game: this.matchConfig.gameId,
        mode: "online",
        winner: online.opponentTeam,
        score: { ...this.turnManager.score },
        player: online.team,
      });
      void syncStats();
    }
    online.leave();
  }

  /** Message about the connection, centered under the HUD (the HUD's own notice slot is taken by the alarm gauge). */
  private showOnlineToast(text: string | null): void {
    this.onlineToast?.destroy();
    this.onlineToast = undefined;
    if (text === null) return;
    this.onlineToast = this.add
      .text(GAME_WIDTH / 2, 170, text, { ...bodyText(30, hex(COLORS.panicHot), "700"), backgroundColor: hex(COLORS.panel), padding: { x: 24, y: 12 } })
      .setOrigin(0.5)
      .setDepth(150);
  }

  /** The opponent quit, lost their connection for good, or stopped answering: the match is ours. */
  private opponentGone(reason: PeerLeftReason | "silence"): void {
    if (this.onlineEnded || this.turnManager.phase === "GAME_OVER") return;
    this.onlineEnded = true;
    this.online?.close();
    this.localController()?.setEnabled(false);
    this.hud.setGoVisible(false);
    this.hud.setBanner(null, "", "");
    this.showOnlineToast(reason === "quit" ? "Ton adversaire a quitté la partie" : "Ton adversaire est déconnecté");
    this.turnManager.endGame(this.localTeam, this.turnManager.score);
    this.time.delayedCall(2200, () => this.finishGame(this.localTeam));
  }

  // ───────────────────────── determinism check ─────────────────────────

  /** Everything that decides how the bodies move from here, in a fixed order: the same on two devices in sync. */
  private worldValues(): number[] {
    const values: number[] = [];
    for (const body of this.matter.world.getAllBodies() as MatterJS.BodyType[]) {
      if (body.isStatic) continue;
      values.push(
        body.position.x, body.position.y, body.angle, body.velocity.x, body.velocity.y,
        body.angularVelocity, body.positionPrev.x, body.positionPrev.y, body.anglePrev,
      );
    }
    return values;
  }

  /** Copies a world taken by `worldValues()` onto our bodies. False (and nothing changed) if the bodies do not match. */
  private applyWorldValues(values: number[]): boolean {
    const bodies = (this.matter.world.getAllBodies() as MatterJS.BodyType[]).filter((b) => !b.isStatic);
    if (values.length !== bodies.length * WORLD_VALUES_PER_BODY) return false;
    bodies.forEach((body, i) => {
      const v = values.slice(i * WORLD_VALUES_PER_BODY, (i + 1) * WORLD_VALUES_PER_BODY);
      Body.setPosition(body, { x: v[0], y: v[1] }, false);
      Body.setAngle(body, v[2], false);
      // Set last and directly: the helpers above also touch the previous-step fields.
      body.velocity.x = v[3];
      body.velocity.y = v[4];
      body.angularVelocity = v[5];
      body.positionPrev.x = v[6];
      body.positionPrev.y = v[7];
      body.anglePrev = v[8];
    });
    return true;
  }

  /** Hash of the world, bit for bit: two devices agree on it only if their simulations agree. */
  private worldHash(): string {
    return hashNumbers(this.worldValues());
  }

  /** Logs this turn's end state. Returns true once the requested number of turns is done (report shown). */
  private recordSyncTurn(what: string): boolean {
    const options = this.matchConfig.syncTest;
    if (!options) return false;
    this.syncLines.push(`tour ${this.syncLines.length + 1}  ${this.worldHash()}  ${what}`);
    if (this.syncLines.length < options.turns) {
      this.showSyncReport();
      return false;
    }
    this.showSyncReport("terminé");
    return true;
  }

  private showSyncReport(note = ""): void {
    const lines = [
      `SYNCTEST ${this.matchConfig.gameId}  graine ${this.matchConfig.seed}`,
      ...this.syncLines,
      note ? `${note.toUpperCase()}  ·  ${this.syncLines.length} tours` : "",
    ];
    const text = lines.filter(Boolean).join("\n");
    if (!this.syncReport) {
      this.syncReport = this.add
        .text(30, 110, text, { fontFamily: "monospace", fontSize: "30px", color: "#ffffff", backgroundColor: "#000000cc", padding: { x: 14, y: 10 } })
        .setDepth(1000);
    } else {
      this.syncReport.setText(text);
    }
  }

  // ───────────────────────────── pause ─────────────────────────────

  private openPause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.localController()?.setEnabled(false);
    this.pauseOverlay = createPauseOverlay(this, {
      onResume: () => this.closePause(),
      // A restart needs both players: online matches only offer to leave.
      onRestart: this.online
        ? undefined
        : () => {
            this.pauseOverlay?.destroy();
            this.pauseOverlay = undefined;
            this.isPaused = false;
            this.scene.restart({ ...this.matchConfig, seed: newSeed() });
          },
      onQuit: () => {
        this.forfeitOnlineMatch();
        this.scene.start(SceneKeys.Menu);
      },
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

    // Online, the opponent keeps playing: the pause menu does not stop our clock or simulation.
    if ((this.isPaused && !this.online) || this.handoffOverlay) return;

    const isPassPlayRedStage =
      this.matchConfig.mode === "passPlay" && this.turnManager.phase === "AIMING" && this.passPlayStage === "red";

    if (isPassPlayRedStage) {
      this.localStageRemainingMs = Math.max(0, this.localStageRemainingMs - dt);
      this.hud.setAimTimer(this.localStageRemainingMs, AIM_DURATION_MS);
      if (this.localStageRemainingMs <= 0) this.advancePassPlayStage();
      return;
    }

    if (this.online) {
      this.onlineTick(dt);
    } else if (this.turnManager.phase === "AIMING") {
      this.turnManager.update(dt, []);
      if (this.turnManager.phase === "AIMING") this.hud.setAimTimer(this.turnManager.aimTimeRemainingMs, AIM_DURATION_MS);
    }

    // Fixed-step physics: same simulation whatever the display's refresh rate.
    this.stepAccumulatorMs += dt;
    let steps = 0;
    while (this.stepAccumulatorMs >= FIXED_TIMESTEP_MS && steps < MAX_STEPS_PER_FRAME) {
      // Online, the world only moves during a resolution. Anywhere else the number of steps would depend
      // on how long each player took to aim, and the two devices would drift apart.
      if (this.online && this.turnManager.phase !== "RESOLVING") {
        this.stepAccumulatorMs = 0;
        break;
      }
      this.stepAccumulatorMs -= FIXED_TIMESTEP_MS;
      steps += 1;
      this.stepSimulation();
    }
    if (steps === MAX_STEPS_PER_FRAME) this.stepAccumulatorMs = 0;
  }

  private stepSimulation(): void {
    const resolving = this.turnManager.phase === "RESOLVING";

    if (resolving) {
      for (const b of this.aliveBots()) b.stepMotion(this.rngShots);
      if (this.clock && this.mode.clock) {
        this.clock.step(this.simTimeMs, this.allBots().map((b) => b.position), this.mode.clock.fieldRect, this.rngSteer);
        this.tickRing();
      }
    }

    this.matter.world.step(FIXED_TIMESTEP_MS);
    this.simTimeMs += FIXED_TIMESTEP_MS;
    this.processImpacts();

    if (this.turnManager.phase !== "RESOLVING") return;
    this.mode.afterStep?.(this.modeContext());
    this.refreshStanding();

    if (this.clock && this.mode.clock) {
      const { x, y } = this.clock.position;
      const scoring = this.mode.clock.checkScore(x, y, CLOCK_RADIUS);
      if (scoring) {
        this.turnManager.reportGoal(scoring);
        return;
      }
    }

    const speeds = [
      ...this.aliveBots().map((b) => b.speed),
      ...(this.clock ? [this.clock.speed] : []),
      ...(this.mode.extraSpeeds?.() ?? []),
      ...this.debris.speeds(),
    ];
    this.turnManager.update(FIXED_TIMESTEP_MS, speeds);
  }

  /** Alarm bell SFX while the clock is awake and running. */
  private tickRing(): void {
    if (!this.clock?.isRunning(this.simTimeMs)) return;
    this.ringTimerMs -= FIXED_TIMESTEP_MS;
    if (this.ringTimerMs <= 0) {
      this.ringTimerMs = panicConfig(this.clock.level).ringPeriodMs;
      SFX.playRing(this.clock.level);
    }
  }

  private syncVisuals(dtMs: number): void {
    const t = this.time.now / 1000;
    for (const b of this.allBots()) b.syncVisuals(t);
    this.clock?.syncVisuals(this.simTimeMs, dtMs / 1000);
    this.mode.syncVisuals?.(this.simTimeMs, dtMs / 1000);
    this.debris.syncVisuals();
  }
}
