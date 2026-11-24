import Phaser from "phaser";
import { CHAT_COOLDOWN_MS, QUICK_MESSAGES } from "@/config/chat";
import { COLORS } from "@/config/theme";
import type { OnlineSession } from "@/net/OnlineSession";
import { createButton } from "@/ui/Button";
import { bodyText, hex } from "@/ui/ui";
import { GAME_WIDTH } from "@/config/game";

const TOAST_MS = 3200;

/**
 * Quick messages for an online scene: a small button opens a list of jokes; the opponent's ones pop
 * up as a toast. Cleans itself up when the scene shuts down.
 */
export function attachChat(scene: Phaser.Scene, session: OnlineSession, x: number, y: number): void {
  let menu: Phaser.GameObjects.Container | undefined;
  let toast: Phaser.GameObjects.Text | undefined;
  let lastSent = -Infinity;

  const closeMenu = () => {
    menu?.destroy();
    menu = undefined;
  };

  const showToast = (text: string, mine: boolean) => {
    toast?.destroy();
    toast = scene.add
      .text(GAME_WIDTH / 2, mine ? 250 : 220, mine ? `Toi : ${text}` : `Adversaire : ${text}`, {
        ...bodyText(34, mine ? COLORS.textMuted : hex(COLORS.yellow), "700"),
        backgroundColor: hex(COLORS.panel),
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setDepth(400);
    const mineToast = toast;
    scene.time.delayedCall(TOAST_MS, () => {
      if (toast === mineToast) toast = undefined;
      mineToast.destroy();
    });
  };

  const send = (id: number) => {
    closeMenu();
    if (session.isClosed || scene.time.now - lastSent < CHAT_COOLDOWN_MS) return;
    lastSent = scene.time.now;
    session.say(id);
    showToast(QUICK_MESSAGES[id], true);
  };

  const openMenu = () => {
    if (menu) return closeMenu();
    const w = 560;
    const rowH = 84;
    const h = QUICK_MESSAGES.length * rowH + 30;
    const left = Math.min(x + 20, GAME_WIDTH - w - 20);
    const top = y + 50;
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panel, 0.97);
    panel.fillRoundedRect(left, top, w, h, 22);
    panel.lineStyle(3, COLORS.panelBorder, 1);
    panel.strokeRoundedRect(left, top, w, h, 22);
    const items: Phaser.GameObjects.GameObject[] = [panel];
    QUICK_MESSAGES.forEach((text, i) => {
      items.push(createButton(scene, left + w / 2, top + 15 + rowH / 2 + i * rowH - 8, text, () => send(i), { variant: "ghost", width: w - 40, height: 64, fontSize: 28 }));
    });
    menu = scene.add.container(0, 0, items).setDepth(390);
  };

  const button = createButton(scene, x, y, "💬", openMenu, { variant: "ghost", width: 70, height: 70, fontSize: 34 }).setDepth(380);

  session.onSay = (id) => {
    const text = QUICK_MESSAGES[id];
    if (text) showToast(text, false);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    session.onSay = undefined;
    closeMenu();
    toast?.destroy();
    button.destroy();
  });
}
