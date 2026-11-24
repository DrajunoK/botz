import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/config/game";
import { COLORS } from "@/config/theme";
import { WORLD_LEFT, WORLD_WIDTH } from "@/config/viewport";
import { GAME_INFO, GameId } from "@/config/tournament";
import { Rng } from "@/game/Rng";
import { Tournament } from "@/game/Tournament";
import { MatchConfig, newSeed } from "@/game/MatchConfig";
import { OnlineSession } from "@/net/OnlineSession";
import { makeRoomCode, normalizeRoomCode, roomLink } from "@/net/protocol";
import type { LocalRoomLink } from "@/net/localRoom";
import { openRoom } from "@/net/realtime";
import { newId } from "@/state/id";
import { createButton } from "@/ui/Button";
import { bodyText, hex, titleText } from "@/ui/ui";
import { centerOnDesignArea } from "@/ui/viewport";
import { SceneKeys } from "./keys";

export interface LobbyData {
  /** Game the host will offer (a guest plays whatever the host picked). */
  gameId: GameId;
  /** Development shortcut: skip the screens and go straight into this room (see net/localRoom.ts). */
  localRoom?: LocalRoomLink;
  /** An invite link (`?room=AB3K`) was opened: join this room straight away. */
  joinCode?: string;
  /** Host only: offer a whole tournament (3 random games) instead of the single `gameId`. */
  tournament?: boolean;
}

/** A guest who hears nothing from the room this long is told it does not exist (or is not waiting). */
const JOIN_TIMEOUT_MS = 10_000;

/**
 * Online match setup: one player creates a room and reads out its 4-letter code, the other joins
 * with it. When both are in, both devices start the same game from the same seed.
 */
export class LobbyScene extends Phaser.Scene {
  private gameId: GameId = "soccer";
  private session?: OnlineSession;
  private handedOver = false;
  private layer?: Phaser.GameObjects.Container;
  private autoplay = false;
  private drift = false;
  private joinCode?: string;
  private wantsTournament = false;
  private pendingLocalRoom?: LocalRoomLink;

  constructor() {
    super(SceneKeys.Lobby);
  }

  init(data: LobbyData): void {
    this.gameId = data.gameId;
    this.autoplay = data.localRoom?.autoplay ?? false;
    this.drift = data.localRoom?.drift ?? false;
    this.joinCode = data.joinCode;
    this.wantsTournament = data.tournament ?? false;
    this.pendingLocalRoom = data.localRoom;
    this.session = undefined;
    this.handedOver = false;
    this.layer = undefined;
  }

  create(): void {
    centerOnDesignArea(this);
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(COLORS.night, 1);
    bg.fillRect(WORLD_LEFT, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Leaving without a match: free the room. Once the match starts the game scene owns the session.
      if (!this.handedOver) this.session?.close();
    });
    const shortcut = this.pendingLocalRoom;
    if (shortcut?.role === "host") this.host(shortcut.code);
    else if (shortcut) this.join(shortcut.code);
    else if (this.joinCode) this.join(this.joinCode);
    else this.showChoice();
  }

  // ───────────────────────────── screens ─────────────────────────────

  private show(build: (add: (o: Phaser.GameObjects.GameObject) => void) => void): void {
    this.layer?.destroy();
    const objects: Phaser.GameObjects.GameObject[] = [];
    build((o) => objects.push(o));
    this.layer = this.add.container(0, 0, objects);
  }

  private heading(add: (o: Phaser.GameObjects.GameObject) => void, subtitle: string): void {
    add(this.add.text(GAME_WIDTH / 2, 150, "EN LIGNE", titleText(84, hex(COLORS.yellow))).setOrigin(0.5));
    const what = this.wantsTournament ? "Tournoi" : GAME_INFO[this.gameId].name;
    add(this.add.text(GAME_WIDTH / 2, 235, `${what} · ${subtitle}`, bodyText(32, COLORS.textMuted, "600")).setOrigin(0.5));
  }

  private showChoice(): void {
    this.closeSession();
    this.show((add) => {
      this.heading(add, "un ami, un autre écran");
      add(createButton(this, GAME_WIDTH / 2 - 250, 470, "Créer une salle", () => this.host(), { variant: "primary", width: 440, height: 110, fontSize: 34 }));
      add(createButton(this, GAME_WIDTH / 2 + 250, 470, "Rejoindre", () => this.join(), { variant: "danger", width: 440, height: 110, fontSize: 34 }));
      add(this.add.text(GAME_WIDTH / 2, 600, "Celui qui crée la salle choisit le jeu et reçoit un code à 4 caractères.\nL'autre le saisit pour la rejoindre.", { ...bodyText(26, COLORS.textFaint, "500"), align: "center" }).setOrigin(0.5));
      add(createButton(this, GAME_WIDTH / 2, 780, "Retour", () => this.scene.start(SceneKeys.Menu), { variant: "ghost", width: 300, height: 70, fontSize: 28 }));
    });
  }

  private showMessage(title: string, detail: string, back = true): void {
    this.show((add) => {
      this.heading(add, "");
      add(this.add.text(GAME_WIDTH / 2, 420, title, titleText(48)).setOrigin(0.5));
      add(this.add.text(GAME_WIDTH / 2, 500, detail, { ...bodyText(28, COLORS.textMuted, "500"), align: "center" }).setOrigin(0.5));
      add(createButton(this, GAME_WIDTH / 2, 700, back ? "Retour" : "Annuler", () => this.showChoice(), { variant: "ghost", width: 300, height: 70, fontSize: 28 }));
    });
  }

  // ───────────────────────────── host ─────────────────────────────

  private host(code = makeRoomCode()): void {
    const clientId = newId();
    const room = openRoom(code, clientId);
    const session = new OnlineSession(room, "host", clientId);
    this.session = session;
    session.onStart = ({ game, seed, games }) => this.launch(session, game, seed, games);
    const seed = newSeed();
    if (this.wantsTournament) {
      const games = [...new Tournament({ rng: new Rng(seed) }).games];
      session.offerMatch(games[0], seed, games);
    } else {
      session.offerMatch(this.gameId, seed);
    }

    this.show((add) => {
      this.heading(add, "ta salle");
      add(this.add.text(GAME_WIDTH / 2, 380, "CODE DE LA SALLE", bodyText(26, COLORS.textFaint, "700")).setOrigin(0.5).setLetterSpacing(4));
      add(this.add.text(GAME_WIDTH / 2, 500, [...code].join(" "), titleText(150, hex(COLORS.yellow))).setOrigin(0.5));
      add(this.add.text(GAME_WIDTH / 2, 640, "Donne ce code à ton ami : il choisit « Rejoindre ».\nLa partie démarre dès qu'il est là.", { ...bodyText(28, COLORS.textMuted, "500"), align: "center" }).setOrigin(0.5));
      const status = this.add.text(GAME_WIDTH / 2, 715, "", bodyText(26, COLORS.textMuted, "600")).setOrigin(0.5);
      add(status);
      add(createButton(this, GAME_WIDTH / 2 - 190, 780, "Partager le lien", () => void this.shareInvite(code, status), { variant: "primary", width: 340, height: 70, fontSize: 28 }));
      add(createButton(this, GAME_WIDTH / 2 + 190, 780, "Annuler", () => this.showChoice(), { variant: "ghost", width: 300, height: 70, fontSize: 28 }));
    });

    void room.joined.then((ok) => {
      if (!ok && this.session === session) this.showMessage("Connexion impossible", "Vérifie ta connexion, puis réessaie.");
    });
  }

  /** Phone: the share sheet (WhatsApp, SMS...). Elsewhere: the link goes to the clipboard. */
  private async shareInvite(code: string, status: Phaser.GameObjects.Text): Promise<void> {
    const url = roomLink(window.location.origin, code);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Botz", text: `Viens jouer à Botz ! Salle ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      status.setText("Lien copié : colle-le à ton ami");
    } catch {
      status.setText(`Lien : ${url}`); // share sheet dismissed or clipboard refused: show it instead
    }
  }

  // ───────────────────────────── guest ─────────────────────────────

  private join(known?: string): void {
    let code = known ?? null;
    if (!code) {
      const typed = window.prompt("Code de la salle (4 caractères) :");
      if (typed === null) return;
      code = normalizeRoomCode(typed);
    }
    if (!code) {
      this.showMessage("Code invalide", "Le code a 4 caractères : des lettres et des chiffres.");
      return;
    }

    const clientId = newId();
    const room = openRoom(code, clientId);
    const session = new OnlineSession(room, "guest", clientId);
    this.session = session;
    session.onStart = ({ game, seed, games }) => this.launch(session, game, seed, games);
    this.show((add) => {
      this.heading(add, `salle ${code}`);
      add(this.add.text(GAME_WIDTH / 2, 470, "Connexion à la salle…", titleText(48)).setOrigin(0.5));
      add(createButton(this, GAME_WIDTH / 2, 700, "Annuler", () => this.showChoice(), { variant: "ghost", width: 300, height: 70, fontSize: 28 }));
    });

    void room.joined.then((ok) => {
      if (this.session !== session) return;
      if (!ok) {
        this.showMessage("Connexion impossible", "Vérifie ta connexion, puis réessaie.");
        return;
      }
      this.time.delayedCall(JOIN_TIMEOUT_MS, () => {
        if (this.session === session && !this.handedOver) this.showMessage("Salle introuvable", `Personne n'attend dans la salle ${code}.\nVérifie le code avec ton ami.`);
      });
    });
  }

  // ───────────────────────────── start ─────────────────────────────

  private launch(session: OnlineSession, gameId: GameId, seed: number, games?: GameId[]): void {
    if (this.handedOver || this.session !== session) return;
    this.handedOver = true;
    const config: MatchConfig = { mode: "online", difficulty: "normal", seed, gameId, online: session, onlineAutoplay: this.autoplay, onlineDrift: this.drift };
    if (games) config.tournament = new Tournament({ games });
    this.scene.start(SceneKeys.Game, config);
  }

  private closeSession(): void {
    this.session?.close();
    this.session = undefined;
  }
}
