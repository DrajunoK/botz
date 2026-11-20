import Phaser from "phaser";
import { FONTS } from "@/config/theme";
import { SceneKeys } from "./keys";
import { ALL_GAMES, PLAYABLE_GAMES } from "@/config/tournament";
import { parseLocalRoom } from "@/net/localRoom";
import { roomFromLink } from "@/net/protocol";
import { Tournament } from "@/game/Tournament";
import { parseSyncTest } from "@/game/syncTest";
import type { MatchConfig } from "@/game/MatchConfig";
import type { RankingData } from "./RankingScene";
import { syncStats } from "@/net/cloud";

/**
 * Everything is drawn with Graphics, so the only thing to wait for is the two web fonts:
 * canvas text would otherwise render once with a fallback face and never refresh.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    void syncStats(); // upload games finished while offline
    const start = () => this.startSyncTest() || this.startLocalRoom() || this.startInvite() || (import.meta.env.DEV && this.startPreview()) || this.scene.start(SceneKeys.Menu);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) {
      start();
      return;
    }
    const loads = Promise.all([fonts.load(`32px ${FONTS.title}`), fonts.load(`600 20px ${FONTS.body}`), fonts.load(`700 20px ${FONTS.body}`)]);
    // Never block the game on a slow font: fall through after 2.5 s.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
    void Promise.race([loads, timeout]).then(start, start);
  }

  /** `?synctest=soccer&seed=42` opens the hidden determinism check (see game/syncTest.ts). */
  private startSyncTest(): boolean {
    const config = parseSyncTest(window.location.search);
    if (!config) return false;
    this.scene.start(SceneKeys.Game, config);
    return true;
  }

  /** `?localroom=ABCD&role=host&game=soccer&auto=1`: an online match between two tabs of one browser (see net/localRoom.ts). */
  private startLocalRoom(): boolean {
    const link = parseLocalRoom(window.location.search);
    if (!link) return false;
    const game = PLAYABLE_GAMES.find((g) => g === link.game) ?? "soccer";
    this.scene.start(SceneKeys.Lobby, { gameId: game, localRoom: link });
    return true;
  }

  /** An invite link (`?room=AB3K`) goes straight to joining that room. */
  private startInvite(): boolean {
    const code = roomFromLink(window.location.search);
    if (!code) return false;
    window.history.replaceState(null, "", window.location.pathname); // a reload must not re-join an old room
    this.scene.start(SceneKeys.Lobby, { gameId: PLAYABLE_GAMES[0], joinCode: code });
    return true;
  }

  /** Dev only: `#ranking` or `#final` opens the tournament screens on a made-up 3-game tournament. */
  private startPreview(): boolean {
    const target = window.location.hash;
    if (target !== "#ranking" && target !== "#final") return false;
    const tournament = new Tournament({ games: ALL_GAMES });
    tournament.record({ game: "soccer", winner: "red", score: { red: 2, yellow: 1 } });
    if (target === "#final") {
      tournament.record({ game: "survivor", winner: "yellow", score: { red: 0, yellow: 1 } });
      tournament.record({ game: "petanque", winner: "red", score: { red: 3, yellow: 1 } });
    }
    const matchConfig: MatchConfig = { mode: "solo", difficulty: "normal", seed: 1, gameId: "survivor", tournament };
    const data: RankingData = { matchConfig, tournament };
    this.scene.start(SceneKeys.Ranking, data);
    return true;
  }
}
