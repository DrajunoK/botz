// Generates the app icon and splash screen source images as flat vector-style
// PNGs (same look as the in-game bots), with no external image tooling or
// network access — see png.mjs for the from-scratch PNG encoder.
import { writeFileSync } from "node:fs";
import { Canvas } from "./png.mjs";

const BG = [13, 17, 23]; // #0d1117
const RED = [239, 68, 68]; // team red, matches TEAM_COLORS.red
const INK = [15, 23, 42, 90]; // visor / rivets, semi-transparent dark
const EYE = [125, 211, 252]; // visor LED cyan
const WHITE = [241, 245, 249];

function drawBot(canvas, cx, cy, radius) {
  canvas.fillCircle(cx, cy, radius, RED);

  // Rivets.
  for (const deg of [45, 135, 225, 315]) {
    const rad = (deg * Math.PI) / 180;
    canvas.fillCircle(cx + Math.cos(rad) * (radius - radius * 0.24), cy + Math.sin(rad) * (radius - radius * 0.24), radius * 0.045, INK);
  }

  // Visor.
  const visorW = radius * 1.1;
  const visorH = radius * 0.64;
  canvas.fillRoundedRect(cx - visorW / 2, cy - visorH / 2, visorW, visorH, visorH * 0.35, INK);

  // Eye LED.
  canvas.fillCircle(cx + radius * 0.18, cy, radius * 0.16, EYE);

  // Antenna.
  const antennaTopY = cy - radius - radius * 0.28;
  canvas.fillRect(cx - radius * 0.02, antennaTopY, radius * 0.04, radius * 0.28, INK);
  canvas.fillCircle(cx, antennaTopY, radius * 0.1, WHITE);
}

function buildIcon(size) {
  const canvas = new Canvas(size, size);
  canvas.fillRect(0, 0, size, size, BG);
  // Keep the bot within Android's adaptive-icon safe zone (~66% of the canvas).
  drawBot(canvas, size / 2, size / 2, size * 0.3);
  return canvas.toPNG();
}

function buildSplash(size) {
  const canvas = new Canvas(size, size);
  canvas.fillRect(0, 0, size, size, BG);
  drawBot(canvas, size / 2, size / 2, size * 0.14);
  return canvas.toPNG();
}

writeFileSync(new URL("../resources/icon.png", import.meta.url), buildIcon(1024));
writeFileSync(new URL("../resources/splash.png", import.meta.url), buildSplash(2732));
writeFileSync(new URL("../resources/splash-dark.png", import.meta.url), buildSplash(2732));

console.log("Generated resources/icon.png, resources/splash.png, resources/splash-dark.png");
