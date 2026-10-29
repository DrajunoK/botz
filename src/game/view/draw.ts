import Phaser from "phaser";

/** Small Graphics helpers shared by the botz / alarm clock / UI renderers. */

/** Strokes a quadratic Bézier (SVG `q`), since Graphics has no curve primitive for open paths. */
export function strokeQuad(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps = 10,
): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push(new Phaser.Math.Vector2(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1));
  }
  g.strokePoints(pts, false);
}

/** Line with round end caps (Graphics lines have butt caps). */
export function roundLine(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, width: number, color: number, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  g.lineBetween(x0, y0, x1, y1);
  g.fillStyle(color, alpha);
  g.fillCircle(x0, y0, width / 2);
  g.fillCircle(x1, y1, width / 2);
}

/**
 * Four-point sparkle star (the `spark` symbol of the mockups). Drawn as two convex diamonds:
 * Graphics fills polygons as a triangle fan, which would mangle a concave star outline.
 */
export function fillSpark(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha = 1): void {
  const k = size * 0.25;
  g.fillStyle(color, alpha);
  g.fillPoints([new Phaser.Math.Vector2(x, y - size), new Phaser.Math.Vector2(x + k, y), new Phaser.Math.Vector2(x, y + size), new Phaser.Math.Vector2(x - k, y)], true);
  g.fillPoints([new Phaser.Math.Vector2(x - size, y), new Phaser.Math.Vector2(x, y - k), new Phaser.Math.Vector2(x + size, y), new Phaser.Math.Vector2(x, y + k)], true);
}

/** Teardrop sweat drop (the `d` path of the clock mockups), centered around (x, y). */
export function fillDrop(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, fill: number, edge: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  const steps = 10;
  // Two cubic curves: M0,-9 C3,-4 3,0 0,0 C-3,0 -3,-4 0,-9
  const cubic = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };
  for (let i = 0; i <= steps; i++) {
    const [px, py] = cubic([0, -9], [3, -4], [3, 0], [0, 0], i / steps);
    pts.push(new Phaser.Math.Vector2(x + px * scale, y + (py + 4.5) * scale));
  }
  for (let i = 1; i <= steps; i++) {
    const [px, py] = cubic([0, 0], [-3, 0], [-3, -4], [0, -9], i / steps);
    pts.push(new Phaser.Math.Vector2(x + px * scale, y + (py + 4.5) * scale));
  }
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  g.lineStyle(Math.max(1, scale * 0.9), edge, 1);
  g.strokePoints(pts, true);
}
