import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { COLORS } from "@/config/theme";
import { ALL_GAMES, GAME_INFO, GameId } from "@/config/tournament";
import { SceneKeys } from "./keys";
import { createButton } from "@/ui/Button";
import { bodyText, drawPill, hex, titleText } from "@/ui/ui";
import { Stats, Tally, summarize } from "@/state/stats";
import { BoardRow, FriendStats, Profile, addFriend, fetchFriends, fetchLeaderboard, fetchProfile, setNickname, syncStats } from "@/net/cloud";

type Tab = "me" | "friends" | "global";
type BoardFilter = GameId | "tournament" | null;

const TABS: { id: Tab; label: string }[] = [
  { id: "me", label: "Moi" },
  { id: "friends", label: "Amis" },
  { id: "global", label: "Global" },
];

const WIN = hex(0x5fc2a8);
const LOSS = hex(0xff7a70);
const LEFT = 80;
const RIGHT = GAME_WIDTH - 80;

/**
 * Stats screen: your own record (read from the phone, works offline), your friends' records and
 * the global ranking (both fetched from Supabase).
 */
export class StatsScene extends Phaser.Scene {
  private tab: Tab = "me";
  private boardFilter: BoardFilter = null;
  private view!: Phaser.GameObjects.Container;
  /** Bumped on every redraw so a slow network answer never paints over a newer screen. */
  private token = 0;
  private profile: Profile | null = null;

  constructor() {
    super(SceneKeys.Stats);
  }

  init(): void {
    this.tab = "me";
    this.boardFilter = null;
    this.profile = null;
  }

  create(): void {
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(COLORS.night, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(LEFT, 36, "STATS", titleText(64, hex(COLORS.yellow)));
    createButton(this, RIGHT - 110, 74, "Menu", () => this.scene.start(SceneKeys.Menu), { variant: "ghost", width: 220, height: 64, fontSize: 28 });

    this.view = this.add.container(0, 0);
    this.render();
    void syncStats(); // make sure the cloud has everything before friends / global are read
  }

  private render(): void {
    const token = ++this.token;
    this.view.removeAll(true);
    this.addTabs();
    if (this.tab === "me") this.renderMe();
    else if (this.tab === "friends") void this.renderFriends(token);
    else void this.renderGlobal(token);
  }

  private fresh(token: number): boolean {
    return token === this.token && this.sys.isActive();
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private text(x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle, origin: [number, number] = [0, 0.5]): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, value, style).setOrigin(origin[0], origin[1]);
    this.view.add(t);
    return t;
  }

  private panel(x: number, y: number, w: number, h: number, fill: number = COLORS.panel): void {
    const g = this.add.graphics();
    drawPill(g, x, y, w, h, 22, fill);
    this.view.add(g);
  }

  private note(message: string, y = 440): void {
    this.text(GAME_WIDTH / 2, y, message, { ...bodyText(30, COLORS.textMuted, "500"), align: "center", wordWrap: { width: 1100 } }, [0.5, 0.5]);
  }

  private addTabs(): void {
    TABS.forEach((t, i) => {
      const active = t.id === this.tab;
      const b = createButton(
        this,
        LEFT + 130 + i * 270,
        170,
        t.label,
        () => {
          this.tab = t.id;
          this.render();
        },
        { width: 250, height: 64, fontSize: 30, variant: active ? "primary" : "ghost" },
      );
      this.view.add(b);
    });
  }

  /** "5 V · 2 D" with the wins and losses coloured; draws only show up when there are some. */
  private tally(x: number, y: number, t: Tally, size = 30, origin = 0): void {
    const parts: [string, string][] = [
      [`${t.wins} V`, WIN],
      [`${t.losses} D`, LOSS],
    ];
    if (t.draws > 0) parts.push([`${t.draws} N`, COLORS.textMuted]);
    let cx = x;
    const widths = parts.map(([s, c]) => this.add.text(0, 0, s, bodyText(size, c, "700")).setVisible(false));
    const total = widths.reduce((sum, w) => sum + w.width, 0) + 26 * (parts.length - 1);
    if (origin === 1) cx = x - total;
    parts.forEach(([s, c], i) => {
      this.text(cx, y, s, bodyText(size, c, "700"));
      cx += widths[i].width + 26;
    });
    widths.forEach((w) => w.destroy());
  }

  // ───────────────────────────── tab: me ─────────────────────────────

  private renderMe(): void {
    const s = summarize(Stats.matches, Stats.tournaments, ALL_GAMES);
    const colX = [LEFT + 40, 700, 1000, 1300];
    const headY = 262;
    for (const [i, label] of ["", "JEU SIMPLE", "EN TOURNOI", "TOTAL"].entries()) {
      if (label) this.text(colX[i], headY, label, bodyText(22, COLORS.textFaint, "700")).setLetterSpacing(2);
    }

    const rowH = 100;
    const rows: { name: string; cells: (Tally | null)[] }[] = ALL_GAMES.map((g) => ({
      name: GAME_INFO[g].name,
      cells: [s.games[g].single, s.games[g].tournament, s.games[g].total],
    }));
    rows.push({ name: "Tournois", cells: [null, s.tournaments, null] });

    rows.forEach((row, i) => {
      const y = 300 + i * (rowH + 12);
      this.panel(LEFT, y, RIGHT - LEFT, rowH);
      this.text(colX[0], y + rowH / 2, row.name, titleText(36));
      row.cells.forEach((cell, c) => {
        if (cell) this.tally(colX[c + 1], y + rowH / 2, cell);
        else this.text(colX[c + 1], y + rowH / 2, "–", bodyText(30, COLORS.textFaint, "500"));
      });
    });

    this.text(LEFT, 826, "Parties contre l'ordinateur uniquement (V = victoire, D = défaite).", bodyText(24, COLORS.textFaint, "500"));
  }

  // ───────────────────────────── tab: friends ─────────────────────────────

  private async renderFriends(token: number): Promise<void> {
    this.note("Chargement…");
    const [profile, friends] = await Promise.all([fetchProfile(), fetchFriends()]);
    if (!this.fresh(token)) return;
    this.profile = profile ?? this.profile;
    this.view.removeAll(true);
    this.addTabs();

    if (!profile || !friends) {
      this.note("Hors ligne : impossible de charger tes amis.\nRéessaie quand tu as du réseau.");
      return;
    }

    this.panel(LEFT, 250, RIGHT - LEFT, 130);
    this.text(LEFT + 40, 288, "TON CODE AMI", bodyText(22, COLORS.textFaint, "700")).setLetterSpacing(2);
    this.text(LEFT + 40, 335, profile.friendCode, titleText(56, hex(COLORS.yellow)));
    this.text(760, 288, "TON PSEUDO", bodyText(22, COLORS.textFaint, "700")).setLetterSpacing(2);
    this.text(760, 335, profile.nickname, titleText(44));
    this.view.add(createButton(this, 1330, 290, "Changer", () => this.askNickname(profile.nickname), { variant: "ghost", width: 200, height: 54, fontSize: 24 }));
    this.view.add(createButton(this, 1330, 350, "Ajouter un ami", () => this.askFriend(), { variant: "primary", width: 330, height: 54, fontSize: 24 }));

    if (friends.length === 0) {
      this.note("Aucun ami pour l'instant.\nDonne ton code à un ami, ou entre le sien avec « Ajouter un ami ».", 600);
      return;
    }
    this.friendRows(friends.slice(0, 5));
  }

  private friendRows(friends: FriendStats[]): void {
    this.text(LEFT + 40, 420, "AMIS", bodyText(22, COLORS.textFaint, "700")).setLetterSpacing(2);
    this.text(RIGHT - 40, 420, "V · D PAR JEU (FOOT / SURVIVANT / PÉTANQUE)", bodyText(22, COLORS.textFaint, "700"), [1, 0.5]).setLetterSpacing(2);
    friends.forEach((f, i) => {
      const y = 450 + i * 74;
      this.panel(LEFT, y, RIGHT - LEFT, 66, COLORS.night);
      this.text(LEFT + 40, y + 33, f.nickname, titleText(30));
      const cells = ALL_GAMES.map((g) => f.byGame[g]).map((r) => (r ? `${r.wins}–${r.losses}` : "–"));
      this.text(RIGHT - 40, y + 33, cells.join("   ·   "), bodyText(28, COLORS.textMain, "700"), [1, 0.5]);
      this.text(900, y + 33, `${f.wins} V · ${f.losses} D`, bodyText(28, COLORS.textSoft, "600"));
    });
  }

  private askNickname(current: string): void {
    const value = window.prompt("Ton pseudo (2 à 20 caractères) :", current);
    if (value === null) return;
    void setNickname(value).then((error) => {
      if (error) window.alert(error);
      this.render();
    });
  }

  private askFriend(): void {
    const code = window.prompt("Code ami de ton ami :");
    if (!code || !code.trim()) return;
    void addFriend(code).then((result) => {
      window.alert("error" in result ? result.error : `${result.nickname} est maintenant ton ami !`);
      this.render();
    });
  }

  // ───────────────────────────── tab: global ─────────────────────────────

  private async renderGlobal(token: number): Promise<void> {
    this.addFilters();
    this.note("Chargement…");
    const [rows, profile] = await Promise.all([fetchLeaderboard(this.boardFilter), this.profile ? Promise.resolve(this.profile) : fetchProfile()]);
    if (!this.fresh(token)) return;
    this.profile = profile;
    this.view.removeAll(true);
    this.addTabs();
    this.addFilters();

    if (!rows) {
      this.note("Hors ligne : impossible de charger le classement.\nRéessaie quand tu as du réseau.");
      return;
    }
    if (rows.length === 0) {
      this.note("Personne n'a encore joué ici. Sois le premier !");
      return;
    }
    this.boardRows(rows);
  }

  private addFilters(): void {
    const filters: { id: BoardFilter; label: string }[] = [
      { id: null, label: "Tous" },
      ...ALL_GAMES.map((g) => ({ id: g as BoardFilter, label: GAME_INFO[g].name })),
      { id: "tournament", label: "Tournois" },
    ];
    filters.forEach((f, i) => {
      const active = f.id === this.boardFilter;
      this.view.add(
        createButton(
          this,
          LEFT + 110 + i * 230,
          262,
          f.label,
          () => {
            this.boardFilter = f.id;
            this.render();
          },
          { width: 210, height: 50, fontSize: 24, variant: active ? "primary" : "ghost" },
        ),
      );
    });
  }

  private boardRows(rows: BoardRow[]): void {
    rows.slice(0, 8).forEach((r, i) => {
      const y = 310 + i * 66;
      const mine = r.nickname === this.profile?.nickname;
      this.panel(LEFT, y, RIGHT - LEFT, 58, mine ? 0x1c2547 : COLORS.panel);
      this.text(LEFT + 36, y + 29, `${i + 1}`, titleText(30, i === 0 ? hex(COLORS.yellow) : hex(0x8fa0c4)));
      this.text(LEFT + 120, y + 29, r.nickname, titleText(30, mine ? hex(COLORS.yellow) : "#ffffff"));
      this.tally(RIGHT - 36, y + 29, { wins: r.wins, losses: r.losses, draws: 0 }, 28, 1);
    });
  }
}
