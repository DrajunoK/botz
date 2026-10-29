import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TEAM_COLORS, TEAM_LABEL, TeamId } from "@/config/game";
import { ALL_PARTS } from "@/config/parts";
import { COLORS } from "@/config/theme";
import { GAME_INFO } from "@/config/tournament";
import { SceneKeys } from "./keys";
import { createButton } from "@/ui/Button";
import { bodyText, drawPill, hex, titleText } from "@/ui/ui";
import { MatchConfig, newSeed, playerName } from "@/game/MatchConfig";
import { Tournament } from "@/game/Tournament";
import { drawBot, drawBotShadow } from "@/game/view/botArt";

export interface RankingData {
  matchConfig: MatchConfig;
  tournament: Tournament;
}

/** The ranking mockup is 932×430: scale it to the logical width and center it vertically. */
const S = GAME_WIDTH / 932;
const OY = (GAME_HEIGHT - 430 * S) / 2;
const X = (x: number) => x * S;
const Y = (y: number) => y * S + OY;

const MINT = 0x5fc2a8;
const MINT_DARK = 0x17302b;
const TROPHY_GOLD = 0xf6c234;
const TROPHY_OFF = 0x2a3558;
const CONFETTI = [COLORS.red, COLORS.yellow, MINT, 0x8fa0c4, 0xff6f91];

/**
 * Standings shown between two games ("Classement"). After the last game the same screen turns
 * into the final one: winner, confetti, hopping botz, "Revanche" and "Menu".
 */
export class RankingScene extends Phaser.Scene {
  private matchConfig!: MatchConfig;
  private tournament!: Tournament;

  constructor() {
    super(SceneKeys.Ranking);
  }

  init(data: RankingData): void {
    this.matchConfig = data.matchConfig;
    this.tournament = data.tournament;
  }

  create(): void {
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(COLORS.night, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const over = this.tournament.isOver;
    this.drawHeader(over);
    this.drawTeamCard("red", 32, over);
    this.drawTeamCard("yellow", 476, over);
    this.drawGameCards();

    if (over) {
      this.addButtons(true);
      this.playCelebration();
    } else {
      this.addButtons(false);
    }
  }

  // ───────────────────────────── header ─────────────────────────────

  private drawHeader(over: boolean): void {
    const { tournament } = this;
    const winner = tournament.winner;

    if (over) {
      const title = winner ? `${TEAM_LABEL[winner]} GAGNE !` : "ÉGALITÉ !";
      const color = winner ? hex(TEAM_COLORS[winner]) : hex(COLORS.yellow);
      this.add.text(X(32), Y(22), title, titleText(Math.round(28 * S), color)).setStroke(hex(COLORS.outline), 8);
      this.add.text(X(32), Y(56), winner ? `${playerName(this.matchConfig, winner)} remporte le tournoi` : "Même nombre de trophées", bodyText(Math.round(15 * S), COLORS.textSoft, "500"));
      return;
    }

    this.add.text(X(32), Y(22), "CLASSEMENT", titleText(Math.round(28 * S), hex(COLORS.yellow)));
    this.add.text(X(32), Y(56), `Après le jeu ${tournament.gameIndex} sur ${tournament.games.length}`, bodyText(Math.round(15 * S), COLORS.textSoft, "500"));

    // Workshop pill: the botz are repaired between two games.
    const repaired = tournament.repairBetweenGames;
    const label = repaired ? "vos botz sont réparés" : "les dégâts restent";
    const strong = repaired ? "Atelier" : "Pas d'atelier";
    const pill = this.add.graphics();
    drawPill(pill, X(666), Y(34), X(234), 38 * S, 19 * S);
    const wrench = this.add.graphics();
    this.drawWrench(wrench, X(686), Y(53), 9 * S);
    const t1 = this.add.text(X(706), Y(53), strong, bodyText(Math.round(12 * S), COLORS.textMain, "700")).setOrigin(0, 0.5);
    this.add.text(t1.x + t1.width + 5 * S, Y(53), `: ${label}`, bodyText(Math.round(12 * S), COLORS.textMuted, "500")).setOrigin(0, 0.5);
  }

  private drawWrench(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.lineStyle(Math.max(2, r * 0.28), MINT, 1);
    g.strokePoints([new Phaser.Math.Vector2(cx - r * 0.7, cy + r * 0.7), new Phaser.Math.Vector2(cx + r * 0.1, cy - r * 0.1)], false);
    g.strokeCircle(cx + r * 0.45, cy - r * 0.45, r * 0.5);
  }

  // ───────────────────────────── team cards ─────────────────────────────

  private drawTeamCard(team: TeamId, x0: number, over: boolean): void {
    const { tournament } = this;
    const w = 424;
    const h = 128;
    const y0 = 86;
    const color = TEAM_COLORS[team];
    const leader = tournament.leader === team;
    const trophies = tournament.trophies[team];

    const g = this.add.graphics();
    g.fillStyle(0x1c2547, 1);
    g.fillRoundedRect(X(x0), Y(y0), X(w), h * S, 22 * S);
    g.lineStyle((leader ? 3 : 2) * S, leader ? COLORS.yellow : COLORS.panelBorder, 1);
    g.strokeRoundedRect(X(x0), Y(y0), X(w), h * S, 22 * S);

    g.fillStyle(color, 1);
    g.fillCircle(X(x0 + 22), Y(y0 + 20), 6 * S);
    const label = this.add.text(X(x0 + 36), Y(y0 + 20), TEAM_LABEL[team], bodyText(Math.round(13 * S), COLORS.textSoft, "700")).setOrigin(0, 0.5).setLetterSpacing(2);
    if (leader) this.drawBadge(label.x + label.width + 14 * S, Y(y0 + 20), over ? "VAINQUEUR" : "EN TÊTE");

    this.add.text(X(x0 + 22), Y(y0 + 47), playerName(this.matchConfig, team), titleText(Math.round(17 * S))).setOrigin(0, 0.5);

    // Big trophy count.
    this.add.text(X(x0 + w - 28), Y(y0 + 48), String(trophies), titleText(Math.round(44 * S))).setOrigin(1, 0.5);

    // Trophy row.
    const tg = this.add.graphics();
    for (let i = 0; i < tournament.games.length; i++) {
      this.drawTrophy(tg, X(x0 + w - 28 - (tournament.games.length - 1 - i) * 24), Y(y0 + 105), 11 * S, i < trophies);
    }

    this.drawSquad(team, x0 + 40, y0 + 93, over && tournament.winner === team);
  }

  private drawBadge(x: number, cy: number, text: string): void {
    const t = this.add.text(0, 0, text, bodyText(Math.round(11 * S), COLORS.ink, "700")).setOrigin(0, 0.5).setLetterSpacing(1);
    const w = t.width + 20 * S;
    const h = 22 * S;
    const g = this.add.graphics();
    g.fillStyle(COLORS.yellow, 1);
    g.fillRoundedRect(x, cy - h / 2, w, h, h / 2);
    t.setPosition(x + 10 * S, cy + 1).setDepth(1);
  }

  /** Cup drawn on a 24-unit grid centred on (cx, cy), `size` = half-width in px. */
  private drawTrophy(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, on: boolean): void {
    const k = size / 12;
    const fill = on ? TROPHY_GOLD : TROPHY_OFF;
    const P = (x: number, y: number) => new Phaser.Math.Vector2(cx + x * k, cy + y * k);
    g.lineStyle(2.2 * k, fill, 1);
    g.strokePoints([P(-7, -7), P(-11, -7), P(-10, -1), P(-6, 0)], false);
    g.strokePoints([P(7, -7), P(11, -7), P(10, -1), P(6, 0)], false);
    g.fillStyle(fill, 1);
    g.fillPoints([P(-7, -9), P(7, -9), P(6, -1), P(3, 3), P(-3, 3), P(-6, -1)], true);
    g.fillRect(cx - 1.5 * k, cy + 3 * k, 3 * k, 4 * k);
    g.fillRoundedRect(cx - 5 * k, cy + 7 * k, 10 * k, 3 * k, k);
  }

  private drawSquad(team: TeamId, x0: number, cy: number, hop: boolean): void {
    const scale = (14 * S) / 18;
    for (let i = 0; i < 3; i++) {
      const x = X(x0 + i * 49);
      const y = Y(cy);
      const kept = this.tournament.startingParts(team, i) ?? [...ALL_PARTS];
      const shadow = this.add.graphics();
      drawBotShadow(shadow);
      shadow.setPosition(x, y).setScale(scale);
      const g = this.add.graphics();
      drawBot(g, TEAM_COLORS[team], {
        has: (p) => kept.includes(p),
        lostCount: ALL_PARTS.length - kept.length,
        isWreck: kept.length === 0,
      });
      g.setPosition(x, y).setScale(scale);
      if (hop) {
        this.tweens.add({ targets: [g, shadow], y: `-=${16 * S}`, duration: 340, yoyo: true, repeat: -1, delay: i * 120, ease: "Sine.Out" });
      }
    }
  }

  // ───────────────────────────── game cards ─────────────────────────────

  private drawGameCards(): void {
    const { tournament } = this;
    const count = tournament.games.length;
    const gap = 14;
    const w = (868 - gap * (count - 1)) / count;
    const y0 = 228;
    const h = 90;

    tournament.games.forEach((game, i) => {
      const x0 = 32 + i * (w + gap);
      const info = GAME_INFO[game];
      const result = tournament.results[i];
      const isNext = !tournament.isOver && i === tournament.gameIndex;
      const state = result ? "TERMINÉ" : isNext ? "SUIVANT" : "À VENIR";

      const g = this.add.graphics();
      g.fillStyle(isNext ? MINT_DARK : result ? 0x111a33 : COLORS.night, 1);
      g.fillRoundedRect(X(x0), Y(y0), X(w), h * S, 18 * S);
      if (result || isNext) {
        g.lineStyle((isNext ? 3 : 2) * S, isNext ? MINT : COLORS.panelBorder, 1);
        g.strokeRoundedRect(X(x0), Y(y0), X(w), h * S, 18 * S);
      } else {
        this.strokeDashedRoundRect(g, X(x0), Y(y0), X(w), h * S, 18 * S, 2 * S, COLORS.panelBorder);
      }

      const faint = isNext ? hex(MINT) : COLORS.textFaint;
      this.add.text(X(x0 + 18), Y(y0 + 22), `JEU ${i + 1} · ${state}`, bodyText(Math.round(11 * S), faint, "700")).setOrigin(0, 0.5).setLetterSpacing(2);
      this.add.text(X(x0 + 18), Y(y0 + 47), info.name.toUpperCase(), titleText(Math.round(17 * S), result || isNext ? "#ffffff" : hex(0x6b7aa3))).setOrigin(0, 0.5);

      const lineY = Y(y0 + 72);
      if (result) {
        const dot = this.add.graphics();
        dot.fillStyle(TEAM_COLORS[result.winner], 1);
        dot.fillCircle(X(x0 + 24), lineY, 5 * S);
        const winnerScore = result.score[result.winner];
        const loserScore = Math.min(result.score.red, result.score.yellow);
        this.add
          .text(X(x0 + 36), lineY, `${capitalize(TEAM_LABEL[result.winner])} gagne ${winnerScore} – ${loserScore}`, bodyText(Math.round(14 * S), hex(lighten(TEAM_COLORS[result.winner])), "500"))
          .setOrigin(0, 0.5);
      } else {
        this.add.text(X(x0 + 18), lineY, info.goal, bodyText(Math.round(14 * S), isNext ? COLORS.textMain : COLORS.textFaint, "400")).setOrigin(0, 0.5);
      }
    });
  }

  private strokeDashedRoundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, width: number, color: number): void {
    const pts: Phaser.Math.Vector2[] = [];
    const arc = (cx: number, cy: number, from: number) => {
      for (let i = 0; i <= 6; i++) {
        const a = Phaser.Math.DegToRad(from + (i * 90) / 6);
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
    };
    arc(x + w - r, y + r, -90);
    arc(x + w - r, y + h - r, 0);
    arc(x + r, y + h - r, 90);
    arc(x + r, y + r, 180);
    pts.push(pts[0].clone());

    g.lineStyle(width, color, 1);
    const dash = 9 * S;
    const gap = 6 * S;
    let on = true;
    let left = dash;
    let prev = pts[0];
    g.beginPath();
    g.moveTo(prev.x, prev.y);
    for (let i = 1; i < pts.length; i++) {
      let seg = Phaser.Math.Distance.Between(prev.x, prev.y, pts[i].x, pts[i].y);
      let from = prev;
      while (seg > left) {
        const t = left / seg;
        const mx = from.x + (pts[i].x - from.x) * t;
        const my = from.y + (pts[i].y - from.y) * t;
        if (on) g.lineTo(mx, my);
        else g.moveTo(mx, my);
        seg -= left;
        from = new Phaser.Math.Vector2(mx, my);
        on = !on;
        left = on ? dash : gap;
      }
      left -= seg;
      if (on) g.lineTo(pts[i].x, pts[i].y);
      else g.moveTo(pts[i].x, pts[i].y);
      prev = pts[i];
    }
    g.strokePath();
  }

  // ───────────────────────────── buttons & finale ─────────────────────────────

  private addButtons(final: boolean): void {
    const cy = Y(385);
    const h = 46 * S;
    if (final) {
      createButton(this, X(32 + 120), cy, "Menu", () => this.scene.start(SceneKeys.Menu), { variant: "ghost", width: X(240), height: h, fontSize: Math.round(17 * S) });
      createButton(this, X(900 - 140), cy, "Revanche", () => this.rematch(), { variant: "primary", width: X(280), height: h, fontSize: Math.round(19 * S) });
      return;
    }

    createButton(this, X(32 + 84), cy, "Quitter le tournoi", () => this.scene.start(SceneKeys.Menu), { variant: "ghost", width: X(168), height: h, fontSize: Math.round(15 * S) });
    const next = this.tournament.currentGame!;
    createButton(this, X(900 - 132), cy, `Jeu suivant : ${GAME_INFO[next].name}  →`, () => this.startNextGame(), {
      variant: "primary",
      width: X(264),
      height: h,
      fontSize: Math.round(17 * S),
    });
  }

  private startNextGame(): void {
    const config: MatchConfig = { ...this.matchConfig, gameId: this.tournament.currentGame!, seed: newSeed() };
    this.scene.start(SceneKeys.Game, config);
  }

  private rematch(): void {
    const tournament = new Tournament({ games: this.tournament.games, repairBetweenGames: this.tournament.repairBetweenGames });
    const config: MatchConfig = { ...this.matchConfig, tournament, gameId: tournament.currentGame!, seed: newSeed() };
    this.scene.start(SceneKeys.Game, config);
  }

  /** Confetti raining down over the final screen. */
  private playCelebration(): void {
    for (let i = 0; i < 70; i++) {
      const w = 8 + (i % 3) * 3;
      const piece = this.add.rectangle(Phaser.Math.Between(0, GAME_WIDTH), -20, w, w * 0.6, CONFETTI[i % CONFETTI.length]).setDepth(5).setAngle(i * 37);
      this.tweens.add({
        targets: piece,
        y: GAME_HEIGHT + 30,
        x: piece.x + Phaser.Math.Between(-90, 90),
        angle: piece.angle + Phaser.Math.Between(-540, 540),
        duration: Phaser.Math.Between(2600, 4800),
        delay: Phaser.Math.Between(0, 2400),
        repeat: -1,
      });
    }
  }
}

const capitalize = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

/** Lighter tint of a team color for text on dark cards. */
function lighten(color: number): number {
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}
