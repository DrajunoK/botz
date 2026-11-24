import Phaser from "phaser";
import { GAME_WIDTH, TEAM_COLORS, TeamId } from "@/config/game";
import { EndResult } from "@/game/petanque";
import { bodyText, titleText } from "@/ui/ui";

/**
 * "On mesure !": dashed lines from the jack to each team's closest bot, a "le plus près" badge on the
 * winner and a ring on every bot that scores, then the verdict. Returns a function that removes it all.
 */
export function showMeasure(scene: Phaser.Scene, jack: { x: number; y: number }, result: EndResult): () => void {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics().setDepth(100);
  objects.push(g);

  const dashed = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    g.lineStyle(4, color, 1);
    for (let d = 0; d < len; d += 22) {
      const e = Math.min(d + 12, len);
      g.lineBetween(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e);
    }
  };

  const closest = new Map<TeamId, (typeof result.ranked)[number]>();
  for (const r of result.ranked) if (!closest.has(r.bot.team)) closest.set(r.bot.team, r);
  for (const [team, r] of closest) dashed(jack.x, jack.y, r.bot.x, r.bot.y, TEAM_COLORS[team]);

  for (const r of result.ranked) {
    if (!result.scoringUids.includes(r.bot.uid)) continue;
    g.lineStyle(5, 0xffffff, 1);
    g.strokeCircle(r.bot.x, r.bot.y, 46);
  }

  const lead = result.ranked[0];
  if (lead && result.winner) {
    const badge = scene.add.container(lead.bot.x, lead.bot.y + 66).setDepth(101);
    const text = scene.add.text(0, 0, "le plus près", bodyText(24, "#ffffff", "700")).setOrigin(0.5);
    const bg = scene.add.graphics();
    bg.fillStyle(0x0e1428, 1);
    bg.fillRoundedRect(-text.width / 2 - 18, -22, text.width + 36, 44, 22);
    badge.add([bg, text]);
    objects.push(badge);
  }

  const title = scene.add.text(GAME_WIDTH / 2, 150, "ON MESURE !", titleText(40, "#ffffff")).setOrigin(0.5).setDepth(101).setStroke("#141b31", 8);
  objects.push(title);
  scene.time.delayedCall(1400, () => {
    if (!title.active) return;
    if (result.winner) {
      const label = result.winner === "red" ? "ROUGE" : "JAUNE";
      title.setText(`${label} MARQUE ${result.points} POINT${result.points > 1 ? "S" : ""} !`).setColor(result.winner === "red" ? "#ff8a84" : "#f6c234");
    } else {
      title.setText("ÉGALITÉ : ON REJOUE !");
    }
  });

  return () => {
    for (const o of objects) o.destroy();
  };
}

