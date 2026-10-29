import Phaser from "phaser";
import { FONTS } from "@/config/theme";
import { SceneKeys } from "./keys";
import { TOURNAMENT_ORDER } from "@/config/tournament";
import { Tournament } from "@/game/Tournament";
import type { MatchConfig } from "@/game/MatchConfig";
import type { RankingData } from "./RankingScene";

/**
 * Everything is drawn with Graphics, so the only thing to wait for is the two web fonts:
 * canvas text would otherwise render once with a fallback face and never refresh.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    const start = () => (import.meta.env.DEV && this.startPreview()) || this.scene.start(SceneKeys.Menu);
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

  /** Dev only: `#ranking` or `#final` opens the tournament screens on a made-up 3-game tournament. */
  private startPreview(): boolean {
    const target = window.location.hash;
    if (target !== "#ranking" && target !== "#final") return false;
    const tournament = new Tournament({ games: TOURNAMENT_ORDER });
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
