export interface Vec2 {
  x: number;
  y: number;
}

export interface RoundedRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  radius: number;
}

export interface WallInfo {
  /** Distance from the point to the nearest border (negative if outside). */
  distance: number;
  /** Unit normal of that border, pointing into the pitch. */
  normal: Vec2;
}

/** Nearest-border query on a rounded rectangle. Goal openings are deliberately ignored. */
export function wallInfo(rect: RoundedRect, x: number, y: number): WallInfo {
  const r = rect.radius;
  const cx = Math.min(Math.max(x, rect.left + r), rect.right - r);
  const cy = Math.min(Math.max(y, rect.top + r), rect.bottom - r);
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d > 1e-6) {
    return { distance: r - d, normal: { x: -dx / d, y: -dy / d } };
  }
  // Inside the inner core: nearest straight edge.
  const candidates: WallInfo[] = [
    { distance: x - rect.left, normal: { x: 1, y: 0 } },
    { distance: rect.right - x, normal: { x: -1, y: 0 } },
    { distance: y - rect.top, normal: { x: 0, y: 1 } },
    { distance: rect.bottom - y, normal: { x: 0, y: -1 } },
  ];
  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best));
}

/** True if (x, y) lies inside the rounded rect shrunk by `margin` (use for scattering decoration). */
export function insideRoundedRect(rect: RoundedRect, x: number, y: number, margin = 0): boolean {
  return wallInfo(rect, x, y).distance >= margin;
}

/** Vertical half-extent of the rounded rect at abscissa x (0 outside its horizontal span). */
export function halfHeightAt(rect: RoundedRect, x: number): number {
  if (x < rect.left || x > rect.right) return 0;
  const r = rect.radius;
  const fullHalf = (rect.bottom - rect.top) / 2;
  const dx = x < rect.left + r ? rect.left + r - x : x > rect.right - r ? x - (rect.right - r) : 0;
  if (dx === 0) return fullHalf;
  return fullHalf - r + Math.sqrt(Math.max(0, r * r - dx * dx));
}
