// Generates the app icon and splash screen source images as flat vector-style
// PNGs (same look as the in-game botz and alarm clock, taken from the design
// mockups in specs/), with no external image tooling or network access — see
// png.mjs for the from-scratch PNG encoder.
import { mkdirSync, writeFileSync } from "node:fs";
import { Canvas } from "./png.mjs";

const BG = [20, 27, 49]; // #141b31
const RED = [232, 71, 63]; // #e8473f
const OUTLINE = [43, 34, 51]; // #2b2233
const VISOR = [31, 36, 56]; // #1f2438
const EYE = [143, 243, 255]; // #8ff3ff
const METAL = [185, 194, 211]; // #b9c2d3
const METAL_DARK = [58, 65, 82]; // #3a4152
const WHEEL = [42, 46, 59]; // #2a2e3b
const TIP = [255, 93, 115]; // #ff5d73
const CLOCK_BODY = [255, 111, 145]; // #ff6f91
const CLOCK_EDGE = [122, 33, 64]; // #7a2140
const CLOCK_FACE = [255, 247, 234]; // #fff7ea
const BELL = [244, 185, 66]; // #f4b942
const BELL_EDGE = [138, 90, 18]; // #8a5a12
const GLOSS = [255, 255, 255, 70];

/** Thick line drawn by stamping circles along it. */
function line(canvas, x0, y0, x1, y1, width, color) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    canvas.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
  }
}

/** Bot in the mockups' units (body radius 18), drawn at (cx, cy) with scale k. */
function drawBot(canvas, cx, cy, k) {
  const rr = (x, y, w, h, r, color) => canvas.fillRoundedRect(cx + x * k, cy + y * k, w * k, h * k, r * k, color);

  rr(-10, 12, 20, 9, 4.5, WHEEL);
  for (const x of [-25, 16]) {
    rr(x - 1, -5, 11, 16, 4.5, METAL_DARK);
    rr(x, -4, 9, 14, 4, METAL);
  }
  line(canvas, cx, cy - 17 * k, cx + 3 * k, cy - 28 * k, 3.2 * k, METAL_DARK);
  canvas.fillCircle(cx + 3.5 * k, cy - 31 * k, 4.4 * k, METAL_DARK);
  canvas.fillCircle(cx + 3.5 * k, cy - 31 * k, 3.5 * k, TIP);

  canvas.fillCircle(cx, cy, 19 * k, OUTLINE);
  canvas.fillCircle(cx, cy, 18 * k, RED);
  canvas.fillCircle(cx - 8 * k, cy - 9 * k, 3.2 * k, GLOSS);
  rr(-12, -6, 24, 11, 5.5, VISOR);
  canvas.fillCircle(cx - 5 * k, cy - 0.5 * k, 2.6 * k, EYE);
  canvas.fillCircle(cx + 5 * k, cy - 0.5 * k, 2.6 * k, EYE);
}

/** Alarm clock in the mockups' units (case radius 22), a startled face included. */
function drawClock(canvas, cx, cy, k) {
  for (const x of [-11, 11]) canvas.fillRoundedRect(cx + (x - 7) * k, cy + 18 * k, 14 * k, 8 * k, 4 * k, WHEEL);
  for (const x of [-15, 15]) {
    canvas.fillCircle(cx + x * k, cy - 19 * k, 10 * k, BELL_EDGE);
    canvas.fillCircle(cx + x * k, cy - 19 * k, 8.2 * k, BELL);
  }
  canvas.fillCircle(cx, cy, 23 * k, CLOCK_EDGE);
  canvas.fillCircle(cx, cy, 21 * k, CLOCK_BODY);
  canvas.fillCircle(cx, cy, 16.8 * k, CLOCK_EDGE);
  canvas.fillCircle(cx, cy, 15.5 * k, CLOCK_FACE);
  for (const x of [-6, 6]) {
    canvas.fillCircle(cx + x * k, cy - 3 * k, 5.4 * k, OUTLINE);
    canvas.fillCircle(cx + x * k, cy - 3 * k, 4.2 * k, [255, 255, 255]);
    canvas.fillCircle(cx + x * k, cy - 3 * k, 1.8 * k, OUTLINE);
  }
  canvas.fillCircle(cx, cy + 8.5 * k, 3.6 * k, OUTLINE);
}

function scene(canvas, size, k) {
  canvas.fillRect(0, 0, size, size, BG);
  // The bot on the left, the clock bolting away on the right: the pair (about 97 units wide)
  // is centered on the canvas.
  const botX = size / 2 - 23.5 * k;
  const botY = size * 0.55;
  drawBot(canvas, botX, botY, k);
  drawClock(canvas, botX + 50 * k, botY - 6 * k, k * 0.95);
}

function buildIcon(size) {
  const canvas = new Canvas(size, size);
  // 97 units * size/150 = ~65% of the canvas: inside Android's adaptive-icon safe zone (~66%).
  scene(canvas, size, size / 150);
  return canvas.toPNG();
}

function buildSplash(size) {
  const canvas = new Canvas(size, size);
  scene(canvas, size, size / 400);
  return canvas.toPNG();
}

/** Web icon: the bot's head close-up on a rounded tile, supersampled 4x so tiny sizes stay clean. */
function buildWebIcon(size, { rounded = true } = {}) {
  const ss = 4;
  const big = size * ss;
  const canvas = new Canvas(big, big);
  const k = (big * 0.74) / 58; // bot spans ~58 units from antenna tip to wheel
  if (rounded) canvas.fillRoundedRect(0, 0, big, big, big * 0.22, BG);
  else canvas.fillRect(0, 0, big, big, BG);
  drawBot(canvas, big / 2, big / 2 + 8 * k, k);
  return downscale(canvas, ss).toPNG();
}

/** Box-filter downscale by an integer factor (premultiplied, so transparent corners stay clean). */
function downscale(src, f) {
  const out = new Canvas(src.width / f, src.height / f);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < f; j++) {
        for (let i = 0; i < f; i++) {
          const o = ((y * f + j) * src.width + x * f + i) * 4;
          const w = src.data[o + 3];
          r += src.data[o] * w;
          g += src.data[o + 1] * w;
          b += src.data[o + 2] * w;
          a += w;
        }
      }
      const o = (y * out.width + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round(a / (f * f));
      }
    }
  }
  return out;
}

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/favicon.png", import.meta.url), buildWebIcon(64));
writeFileSync(new URL("../public/apple-touch-icon.png", import.meta.url), buildWebIcon(180, { rounded: false }));
writeFileSync(new URL("../public/icon-192.png", import.meta.url), buildWebIcon(192));
writeFileSync(new URL("../public/icon-512.png", import.meta.url), buildWebIcon(512));

writeFileSync(new URL("../resources/icon.png", import.meta.url), buildIcon(1024));
writeFileSync(new URL("../resources/splash.png", import.meta.url), buildSplash(2732));
writeFileSync(new URL("../resources/splash-dark.png", import.meta.url), buildSplash(2732));

console.log("Generated public/{favicon,apple-touch-icon,icon-192,icon-512}.png, resources/icon.png, resources/splash.png, resources/splash-dark.png");
