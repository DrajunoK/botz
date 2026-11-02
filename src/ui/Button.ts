import Phaser from "phaser";
import { SFX } from "@/game/Audio";
import { COLORS } from "@/config/theme";
import { bodyText, hex, titleText } from "@/ui/ui";

export type ButtonVariant = "primary" | "danger" | "ghost";

export interface ButtonOptions {
  width?: number;
  height?: number;
  variant?: ButtonVariant;
  fontSize?: number;
  /** Round button (the GO button): width is the diameter, label uses the title font. */
  round?: boolean;
}

interface Look {
  face: number;
  edge: number;
  text: string;
  border?: number;
}

const LOOKS: Record<ButtonVariant, Look> = {
  primary: { face: COLORS.yellow, edge: COLORS.yellowEdge, text: COLORS.ink },
  danger: { face: COLORS.redButton, edge: COLORS.redButtonEdge, text: "#ffffff" },
  ghost: { face: COLORS.night, edge: COLORS.night, text: COLORS.textMain, border: 0x3a4770 },
};

const EDGE_DEPTH = 8;

/**
 * Chunky "pressable" button: a darker edge sits fixed under the face, and the face slides
 * down onto it when pressed. Hit area is padded beyond the visible bounds for touch.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const look = LOOKS[options.variant ?? "primary"];
  const round = options.round ?? false;
  const width = options.width ?? 380;
  const height = round ? width : (options.height ?? 76);
  const radius = round ? width / 2 : 22;
  const depth = look.border ? 0 : EDGE_DEPTH;

  const edge = scene.add.graphics();
  if (depth > 0) {
    edge.fillStyle(look.edge, 1);
    edge.fillRoundedRect(-width / 2, -height / 2 + depth, width, height, radius);
  }

  const bg = scene.add.graphics();
  const drawFace = (lift: number) => {
    bg.clear();
    bg.fillStyle(look.face, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    if (look.border) {
      bg.lineStyle(3, look.border, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
    if (lift > 0) {
      bg.fillStyle(0xffffff, lift);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
  };
  drawFace(0);

  const style = round
    ? titleText(options.fontSize ?? Math.round(width * 0.36), look.text)
    : bodyText(options.fontSize ?? 30, look.text, "700");
  const text = scene.add.text(0, round ? 2 : 0, label, style).setOrigin(0.5);

  const face = scene.add.container(0, 0, [bg, text]);
  const container = scene.add.container(x, y, [edge, face]);
  container.setSize(width, height + depth);

  const hitPad = 14;
  // A container's hit area is in top-left-origin coords (it is offset by half its size),
  // not centred on the container's position like the children drawn above.
  container.setInteractive(
    new Phaser.Geom.Rectangle(-hitPad, -hitPad, width + hitPad * 2, height + depth + hitPad * 2),
    Phaser.Geom.Rectangle.Contains,
  );
  container.input!.cursor = "pointer";

  const release = () => {
    scene.tweens.add({ targets: face, y: 0, duration: 110, ease: "Back.Out" });
    drawFace(0);
  };
  container.on("pointerover", () => drawFace(0.08));
  container.on("pointerout", release);
  container.on("pointerdown", () => {
    scene.tweens.add({ targets: face, y: depth || 3, duration: 55, ease: "Quad.Out" });
    drawFace(0);
  });
  container.on("pointerup", () => {
    release();
    SFX.playClick();
    onClick();
  });

  return container;
}

/** Small square icon button (sound toggle, close) in the ghost style. */
export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  drawIcon: (g: Phaser.GameObjects.Graphics) => void,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const btn = createButton(scene, x, y, "", onClick, { width: size, height: size, variant: "ghost" });
  const icon = scene.add.graphics();
  drawIcon(icon);
  (btn.list[1] as Phaser.GameObjects.Container).add(icon);
  return btn;
}

export { hex };
