import Phaser from "phaser";
import { SFX } from "@/game/Audio";
import { shade } from "@/game/util/color";

export type ButtonIcon = "play" | "duo" | "gear" | "none";

export interface ButtonOptions {
  width?: number;
  height?: number;
  fillColor?: number;
  fillAlpha?: number;
  textColor?: string;
  fontSize?: number;
  cornerRadius?: number;
  icon?: ButtonIcon;
}

function drawIcon(g: Phaser.GameObjects.Graphics, icon: ButtonIcon, cx: number, tint: number): void {
  g.fillStyle(tint, 0.95);
  switch (icon) {
    case "play":
      g.fillTriangle(cx - 9, -12, cx - 9, 12, cx + 13, 0);
      break;
    case "duo":
      g.fillCircle(cx - 10, -6, 9);
      g.fillCircle(cx + 10, 6, 9);
      break;
    case "gear": {
      g.fillCircle(cx, 0, 11);
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        g.fillCircle(cx + Math.cos(a) * 15, Math.sin(a) * 15, 4);
      }
      break;
    }
    case "none":
    default:
      break;
  }
}

/**
 * A chunky "pressable chip" button: a solid darker-shade edge sits fixed
 * behind a bright face that physically slides down onto it on press (classic
 * casual-mobile-game "3D button" feel), with a thick outline instead of soft
 * glows. Sized generously for touch, with a hit area padded beyond the
 * visible bounds so edge taps still register.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 280;
  const height = options.height ?? 78;
  const fillColor = options.fillColor ?? 0x2563eb;
  const fillAlpha = options.fillAlpha ?? 1;
  const cornerRadius = options.cornerRadius ?? 22;
  const icon = options.icon ?? "none";
  const iconColor = options.textColor ?? "#ffffff";
  const iconTint = Phaser.Display.Color.HexStringToColor(iconColor).color;
  const edgeDepth = 7;

  // Fixed edge: a solid darker-shade chip sitting "under" the face.
  const edge = scene.add.graphics();
  edge.fillStyle(shade(fillColor, -55), fillAlpha);
  edge.fillRoundedRect(-width / 2, -height / 2 + edgeDepth, width, height, cornerRadius);

  const bg = scene.add.graphics();
  const drawFace = (fill: number) => {
    bg.clear();
    bg.fillStyle(fill, fillAlpha);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
    // Flat glassy top highlight (crisp, not blurred).
    bg.fillStyle(0xffffff, 0.18);
    bg.fillRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height * 0.36, {
      tl: cornerRadius - 5,
      tr: cornerRadius - 5,
      bl: 4,
      br: 4,
    });
    bg.lineStyle(3, shade(fillColor, -55), 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
  };
  drawFace(fillColor);

  const text = scene.add.text(0, 0, label, {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: `${options.fontSize ?? 30}px`,
    color: iconColor,
    fontStyle: "800",
  });
  text.setOrigin(0.5);

  const iconLayer = scene.add.graphics();
  const textWidth = text.width;
  const iconCx = icon === "none" ? 0 : -(textWidth / 2 + 24);
  if (icon !== "none") {
    drawIcon(iconLayer, icon, iconCx, iconTint);
    text.setX(12);
  }

  const face = scene.add.container(0, 0, [bg, iconLayer, text]);
  const container = scene.add.container(x, y, [edge, face]);
  container.setSize(width, height + edgeDepth);

  const hitPad = 14;
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2 - hitPad, -height / 2 - hitPad, width + hitPad * 2, height + edgeDepth + hitPad * 2),
    Phaser.Geom.Rectangle.Contains,
  );
  container.input!.cursor = "pointer";

  const release = () => {
    scene.tweens.add({ targets: face, y: 0, duration: 110, ease: "Back.Out" });
    drawFace(fillColor);
  };
  const press = () => {
    scene.tweens.add({ targets: face, y: edgeDepth, duration: 55, ease: "Quad.Out" });
    drawFace(shade(fillColor, -12));
  };

  container.on("pointerover", () => drawFace(shade(fillColor, 16)));
  container.on("pointerout", release);
  container.on("pointerdown", press);
  container.on("pointerup", () => {
    release();
    SFX.playClick();
    onClick();
  });

  return container;
}
