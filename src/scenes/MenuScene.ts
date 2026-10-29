import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, Difficulty } from "@/config/game";
import { COLORS } from "@/config/theme";
import { SceneKeys } from "./keys";
import { createButton, createIconButton } from "@/ui/Button";
import { bodyText, drawPill, hex, titleText } from "@/ui/ui";
import { card } from "@/ui/Overlays";
import { SettingsStore } from "@/state/settings";
import { MatchConfig, newSeed } from "@/game/MatchConfig";
import { Tournament } from "@/game/Tournament";
import { GAME_INFO, GameId, PLAYABLE_GAMES, TOURNAMENT_ORDER } from "@/config/tournament";
import { BotParts } from "@/game/entities/BotParts";
import { drawAntenna, drawBot, drawBotShadow } from "@/game/view/botArt";
import { drawAlarmClock, drawClockShadow } from "@/game/view/alarmClockArt";
import { CROWD_TILE, CROWD_TILE_H, CROWD_TILE_W, paintSpectator } from "@/game/view/crowd";
import { bakeTexture } from "@/game/view/bake";
import { fillSpark, roundLine } from "@/game/view/draw";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Facile", normal: "Normal", hard: "Difficile" };

/** The home mockup is 932×430: scale it to the logical width and center it vertically. */
const S = GAME_WIDTH / 932;
const OY = (GAME_HEIGHT - 430 * S) / 2;
const X = (x: number) => x * S;
const Y = (y: number) => y * S + OY;

const MENU_TEXTURE_KEY = "botz-menu-bg";

export class MenuScene extends Phaser.Scene {
  private settingsPanel?: Phaser.GameObjects.Container;
  private freePlayPanel?: Phaser.GameObjects.Container;
  private freePlayGame: GameId = PLAYABLE_GAMES[0];
  private clockG!: Phaser.GameObjects.Graphics;
  private clockShadow!: Phaser.GameObjects.Graphics;
  private botG!: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.settingsPanel = undefined;
    this.freePlayPanel = undefined;
    bakeTexture(this, MENU_TEXTURE_KEY, GAME_WIDTH, GAME_HEIGHT, (g) => this.paintBackground(g));
    this.add.image(0, 0, MENU_TEXTURE_KEY).setOrigin(0, 0).setDepth(-20);

    this.addCharacters();
    this.addTitle();
    this.addButtons();

    // Version tag.
    const tag = this.add.graphics();
    drawPill(tag, GAME_WIDTH - 24 - 230, GAME_HEIGHT - 20 - 40, 230, 40, 14);
    this.add.text(GAME_WIDTH - 24 - 115, GAME_HEIGHT - 40, "v0.1 · prototype", bodyText(20, COLORS.textMuted, "500")).setOrigin(0.5);
  }

  update(_time: number, delta: number): void {
    this.t += delta / 1000;
    // The clock is in full panic: keep it shaking.
    const sx = Math.sin(this.t * 41) * 2.2;
    const sy = Math.cos(this.t * 37) * 1.6;
    this.clockG.setPosition(X(832) + sx, Y(214) + sy);
    drawAlarmClock(this.clockG, { level: 3, time: this.t, handAngle: this.t * 11, stunned: false, ringing: true });
  }

  // ───────────────────────────── artwork ─────────────────────────────

  private paintBackground(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.night, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars.
    g.fillStyle(0x3a4770, 1);
    const stars: [number, number, number][] = [
      [380, 40, 1.6], [610, 24, 1.4], [720, 70, 1.8], [430, 110, 1.2], [560, 96, 1.5],
      [120, -30, 1.4], [300, -12, 1.2], [880, -26, 1.6], [820, 120, 1.2], [200, 8, 1.3], [660, -6, 1.2],
    ];
    for (const [x, y, r] of stars) g.fillCircle(X(x), Y(y), r * S);

    // Spotlight cones.
    g.fillStyle(0xfff3c4, 0.06);
    for (const pts of [
      [488, 52, 506, 52, 600, 300 + 80, 380, 300 + 80],
      [872, 52, 890, 52, 930 + 20, 300 + 80, 740, 300 + 80],
    ]) {
      g.fillPoints(
        [0, 1, 2, 3].map((i) => new Phaser.Math.Vector2(X(pts[i * 2]), Y(pts[i * 2 + 1]))),
        true,
      );
    }
    // Floodlight panels.
    for (const [lx, ly] of [[470, 22], [854, 22]]) {
      g.fillStyle(0x2e3a5e, 1);
      g.fillRoundedRect(X(lx), Y(ly), 54 * S, 30 * S, 5 * S);
      g.lineStyle(2 * S, COLORS.outline, 1);
      g.strokeRoundedRect(X(lx), Y(ly), 54 * S, 30 * S, 5 * S);
      g.fillStyle(0xfff3c4, 1);
      for (const dy of [9, 21]) for (const dx of [10, 21, 32, 43]) g.fillCircle(X(lx + dx), Y(ly + dy), 4 * S);
    }

    // Stadium: stands (ellipse), workshop rim, turf.
    const cx = X(466);
    const cy = Y(600);
    const ell = (rx: number, ry: number, fill: number, lineW: number, lineColor: number) => {
      g.fillStyle(fill, 1);
      g.fillEllipse(cx, cy, 2 * X(rx), 2 * X(ry), 160);
      g.lineStyle(lineW * S, lineColor, 1);
      g.strokeEllipse(cx, cy, 2 * X(rx), 2 * X(ry), 160);
    };
    ell(780, 370, COLORS.crowdBase, 4, COLORS.outline);

    const sc = 1.0;
    for (let ty = 0; ty < 520; ty += CROWD_TILE_H) {
      for (let tx = 0; tx < 932; tx += CROWD_TILE_W) {
        for (const [px, py, color] of CROWD_TILE) {
          const mx = tx + px;
          const my = ty + py;
          const inStands = ((mx - 466) / 770) ** 2 + ((my - 600) / 360) ** 2 < 1;
          const onRim = ((mx - 466) / (660 + 10)) ** 2 + ((my - 600) / (290 + 10)) ** 2 < 1;
          if (inStands && !onRim) paintSpectator(g, X(mx), Y(my), S * sc, color);
        }
      }
    }

    ell(660, 290, COLORS.rim, 3, COLORS.outline);
    ell(630, 270, COLORS.turfA, 8, COLORS.lineBorder);

    // Mow stripes, clipped to the turf ellipse by sampling its outline.
    g.fillStyle(COLORS.turfB, 1);
    for (let x0 = 466 - 630 + 29; x0 < 466 + 630; x0 += 58) {
      const x1 = Math.min(x0 + 29, 466 + 630);
      const top: Phaser.Math.Vector2[] = [];
      const bottom: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 8; i++) {
        const x = x0 + ((x1 - x0) * i) / 8;
        const h = 270 * Math.sqrt(Math.max(0, 1 - ((x - 466) / 630) ** 2)) - 3;
        top.push(new Phaser.Math.Vector2(X(x), Y(600 - h)));
        bottom.push(new Phaser.Math.Vector2(X(x), Y(600 + h)));
      }
      g.fillPoints([...top, ...bottom.reverse()], true);
    }
  }

  private addCharacters(): void {
    this.add.text(X(640), Y(332), "HUILE EXTRA-FINE", titleText(Math.round(10 * S), COLORS.textFaint)).setOrigin(0.5).setDepth(-19);

    // Yellow bot at the bottom, speed lines trailing behind.
    const lines = this.add.graphics().setDepth(-5);
    for (const [x0, x1, y, w] of [[440, 470, 352, 3], [430, 466, 366, 3]]) roundLine(lines, X(x0), Y(y), X(x1), Y(y), w * S, 0xc9d2e8, 0.6);
    this.botG = this.add.graphics().setDepth(-4);
    const botShadow = this.add.graphics().setDepth(-4.5);
    drawBotShadow(botShadow);
    drawBot(this.botG, COLORS.yellow, new BotParts());
    this.botG.setPosition(X(520), Y(360)).setScale(2 * S);
    botShadow.setPosition(X(520), Y(360)).setScale(2 * S);
    this.tweens.add({ targets: [this.botG, botShadow], y: `-=${10}`, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    // Red bot, cracked, in the middle; its antenna has just flown off.
    const speedLines = this.add.graphics().setDepth(-5);
    for (const [x0, x1, y] of [[520, 572, 232], [506, 568, 252], [522, 574, 272]]) roundLine(speedLines, X(x0), Y(y), X(x1), Y(y), 4 * S, 0xc9d2e8, 0.6);
    const redShadow = this.add.graphics().setDepth(-3.5);
    drawBotShadow(redShadow);
    redShadow.setPosition(X(640), Y(250)).setScale(2.8 * S);
    const red = this.add.graphics().setDepth(-3);
    const damaged = new BotParts();
    damaged.lose("antenna");
    drawBot(red, COLORS.red, damaged);
    red.setPosition(X(640), Y(250)).setScale(2.8 * S);
    this.tweens.add({ targets: [red, redShadow], x: `+=${6}`, duration: 130, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const antenna = this.add.graphics().setDepth(-2);
    drawAntenna(antenna);
    antenna.setPosition(X(712), Y(150)).setScale(2.8 * S).setAngle(38);
    this.tweens.add({ targets: antenna, angle: 38 + 360, duration: 3200, repeat: -1 });
    this.tweens.add({ targets: antenna, y: `-=${14}`, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const fx = this.add.graphics().setDepth(-2);
    fx.lineStyle(3 * S, 0xc9d2e8, 0.7);
    fx.beginPath();
    fx.arc(X(690 + 14), Y(112 + 4), 16 * S, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(330));
    fx.strokePath();
    roundLine(fx, X(683), Y(212), X(674), Y(206), 3 * S, COLORS.spark);
    roundLine(fx, X(688), Y(206), X(684), Y(197), 3 * S, COLORS.spark);
    roundLine(fx, X(694), Y(214), X(695), Y(204), 3 * S, COLORS.spark);
    fillSpark(fx, X(660), Y(190), 9 * S, COLORS.spark, 0.9);

    // The clock itself, in full panic.
    this.clockShadow = this.add.graphics().setDepth(-1.5);
    drawClockShadow(this.clockShadow);
    this.clockShadow.setPosition(X(832), Y(214)).setScale(2.4 * S);
    this.clockG = this.add.graphics().setDepth(-1).setScale(2.4 * S);
    this.clockG.setPosition(X(832), Y(214));

    this.add
      .text(X(796), Y(122), "DRIIING !", titleText(Math.round(22 * S), hex(COLORS.vibration)))
      .setStroke(hex(COLORS.night), 5 * S)
      .setAngle(-8)
      .setDepth(0);
    for (const [txt, x, y, size] of [["♪", 770, 290, 22], ["♫", 898, 170, 20]] as const) {
      this.add.text(X(x), Y(y), txt, { fontFamily: "Fredoka", fontSize: `${Math.round(size * S)}px`, color: hex(COLORS.vibration) }).setDepth(0);
    }
  }

  private addTitle(): void {
    const size = Math.round(88 * S);
    const x = X(48);
    const y = Y(24);
    const shadow = this.add.text(x + 5 * S, y + 5 * S, "BOTZ", titleText(size, "#d63a33")).setLetterSpacing(2 * S);
    const title = this.add.text(x, y, "BOTZ", titleText(size, hex(COLORS.yellow))).setLetterSpacing(2 * S);
    shadow.setDepth(1);
    title.setDepth(2);
    this.add
      .text(x, Y(126), "Foot, Survivant, Pétanque : un tournoi de petits robots qui perdent leurs pièces.", {
        ...bodyText(Math.round(15 * S), COLORS.textSoft, "400"),
        wordWrap: { width: X(300) },
        lineSpacing: 6,
      })
      .setDepth(2);
  }

  private addButtons(): void {
    const left = X(48);
    const w = X(270);
    const h = 52 * S;
    createButton(this, left + w / 2, Y(186 + 26), "Jouer en solo", () => this.startTournament("solo"), {
      variant: "primary",
      width: w,
      height: h,
      fontSize: Math.round(19 * S),
    });
    createButton(this, left + w / 2, Y(250 + 26), "2 joueurs · même téléphone", () => this.startTournament("passPlay"), {
      variant: "danger",
      width: w,
      height: h,
      fontSize: Math.round(17 * S),
    });
    const gap = X(10);
    const soundW = h;
    const rowW = (w - soundW - gap * 2) / 2;
    const rowY = Y(314 + 26);
    createButton(this, left + rowW / 2, rowY, "Réglages", () => this.toggleSettings(), {
      variant: "ghost",
      width: rowW,
      height: h,
      fontSize: Math.round(15 * S),
    });
    createButton(this, left + rowW + gap + rowW / 2, rowY, "Partie libre", () => this.toggleFreePlay(), {
      variant: "ghost",
      width: rowW,
      height: h,
      fontSize: Math.round(15 * S),
    });
    this.addSoundButton(left + w - soundW / 2, rowY, h);
  }

  private addSoundButton(x: number, y: number, size: number): void {
    let button: Phaser.GameObjects.Container;
    const build = () => {
      button?.destroy();
      button = createIconButton(
        this,
        x,
        y,
        size,
        (g) => drawSpeaker(g, SettingsStore.get().soundOn, size * 0.5),
        () => {
          SettingsStore.setSoundOn(!SettingsStore.get().soundOn);
          build();
        },
      );
    };
    build();
  }

  // ───────────────────────────── navigation ─────────────────────────────

  /** Full tournament: every game of the fixed order, with a ranking screen in between. */
  private startTournament(mode: MatchConfig["mode"]): void {
    const tournament = new Tournament();
    const config: MatchConfig = { mode, difficulty: SettingsStore.get().difficulty, seed: newSeed(), gameId: tournament.currentGame!, tournament };
    this.scene.start(SceneKeys.Game, config);
  }

  /** Free play: a single game, no tournament. */
  private startFreePlay(mode: MatchConfig["mode"], gameId: GameId): void {
    const config: MatchConfig = { mode, difficulty: SettingsStore.get().difficulty, seed: newSeed(), gameId };
    this.scene.start(SceneKeys.Game, config);
  }

  private toggleFreePlay(): void {
    if (this.freePlayPanel) {
      this.freePlayPanel.destroy();
      this.freePlayPanel = undefined;
      return;
    }
    this.freePlayPanel = this.buildFreePlayPanel();
  }

  private buildFreePlayPanel(): Phaser.GameObjects.Container {
    const panelW = 900;
    const panelH = 520;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const dim = this.add.graphics();
    dim.fillStyle(0x070a16, 0.72);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);

    const elements: Phaser.GameObjects.GameObject[] = [dim, card(this, cx, cy, panelW, panelH)];
    elements.push(this.add.text(cx, cy - panelH / 2 + 60, "PARTIE LIBRE", titleText(40, hex(COLORS.yellow))).setOrigin(0.5));
    elements.push(this.add.text(cx, cy - panelH / 2 + 112, "Un seul jeu, pour s'entraîner", bodyText(24, COLORS.textMuted, "500")).setOrigin(0.5));

    TOURNAMENT_ORDER.forEach((game, i) => {
      const x = cx + (i - 1) * 270;
      const playable = PLAYABLE_GAMES.includes(game);
      const selected = playable && this.freePlayGame === game;
      const label = playable ? GAME_INFO[game].name : `${GAME_INFO[game].name} · bientôt`;
      const button = createButton(
        this,
        x,
        cy - 40,
        label,
        () => {
          if (!playable) return;
          this.freePlayGame = game;
          this.refreshFreePlayPanel();
        },
        { width: 250, height: 70, fontSize: playable ? 28 : 21, variant: selected ? "primary" : "ghost" },
      );
      if (!playable) button.setAlpha(0.45);
      elements.push(button);
    });

    elements.push(this.add.text(cx, cy + 50, GAME_INFO[this.freePlayGame].goal, bodyText(26, COLORS.textSoft, "500")).setOrigin(0.5));
    elements.push(createButton(this, cx - 200, cy + 130, "Solo", () => this.startFreePlay("solo", this.freePlayGame), { width: 340, height: 70, fontSize: 28, variant: "primary" }));
    elements.push(createButton(this, cx + 200, cy + 130, "2 joueurs", () => this.startFreePlay("passPlay", this.freePlayGame), { width: 340, height: 70, fontSize: 28, variant: "danger" }));
    elements.push(createButton(this, cx, cy + panelH / 2 - 44, "Fermer", () => this.toggleFreePlay(), { width: 200, height: 52, fontSize: 24, variant: "ghost" }));

    return this.add.container(0, 0, elements).setDepth(500);
  }

  private refreshFreePlayPanel(): void {
    this.freePlayPanel?.destroy();
    this.freePlayPanel = this.buildFreePlayPanel();
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
    const panelW = 700;
    const panelH = 440;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const dim = this.add.graphics();
    dim.fillStyle(0x070a16, 0.72);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);

    const elements: Phaser.GameObjects.GameObject[] = [dim, card(this, cx, cy, panelW, panelH)];
    elements.push(this.add.text(cx, cy - panelH / 2 + 60, "RÉGLAGES", titleText(40, hex(COLORS.yellow))).setOrigin(0.5));

    elements.push(this.add.text(cx - panelW / 2 + 50, cy - 60, "Son", bodyText(30, COLORS.textSoft, "600")).setOrigin(0, 0.5));
    const soundOn = SettingsStore.get().soundOn;
    elements.push(
      createButton(
        this,
        cx + panelW / 2 - 160,
        cy - 60,
        soundOn ? "Activé" : "Coupé",
        () => {
          SettingsStore.setSoundOn(!SettingsStore.get().soundOn);
          this.refreshSettingsPanel();
        },
        { width: 200, height: 60, fontSize: 26, variant: soundOn ? "primary" : "ghost" },
      ),
    );

    elements.push(this.add.text(cx - panelW / 2 + 50, cy + 25, "Difficulté (solo)", bodyText(30, COLORS.textSoft, "600")).setOrigin(0, 0.5));
    DIFFICULTIES.forEach((diff, i) => {
      const active = SettingsStore.get().difficulty === diff;
      elements.push(
        createButton(
          this,
          cx - 210 + i * 210,
          cy + 100,
          DIFFICULTY_LABEL[diff],
          () => {
            SettingsStore.setDifficulty(diff);
            this.refreshSettingsPanel();
          },
          { width: 190, height: 60, fontSize: 24, variant: active ? "primary" : "ghost" },
        ),
      );
    });

    elements.push(createButton(this, cx, cy + panelH / 2 - 44, "Fermer", () => this.toggleSettings(), { width: 200, height: 52, fontSize: 24, variant: "ghost" }));

    return this.add.container(0, 0, elements).setDepth(500);
  }

  private refreshSettingsPanel(): void {
    this.settingsPanel?.destroy();
    this.settingsPanel = this.buildSettingsPanel();
  }
}

/** Speaker glyph from the mockup (24-unit grid), with waves when on and a cross when muted. */
function drawSpeaker(g: Phaser.GameObjects.Graphics, on: boolean, size: number): void {
  const k = size / 24;
  const P = (x: number, y: number) => new Phaser.Math.Vector2((x - 12) * k, (y - 12) * k);
  g.lineStyle(2 * k, 0xe9edf7, 1);
  g.strokePoints([P(4, 9), P(8, 9), P(13, 5), P(13, 19), P(8, 15), P(4, 15)], true);
  if (on) {
    g.beginPath();
    g.arc(1 * k, 0, 4 * k, -Math.PI / 3, Math.PI / 3);
    g.strokePath();
    g.beginPath();
    g.arc(1 * k, 0, 7 * k, -Math.PI / 3, Math.PI / 3);
    g.strokePath();
  } else {
    g.strokePoints([P(16, 9), P(21, 15)], false);
    g.strokePoints([P(21, 9), P(16, 15)], false);
  }
}
