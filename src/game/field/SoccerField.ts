import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TeamId, TEAM_COLORS, BOTZ_PER_TEAM } from "@/config/game";
import { WALL_PHYSICS } from "@/config/physics";
import { shade } from "@/game/util/color";

export const FIELD_LEFT = 140;
export const FIELD_RIGHT = GAME_WIDTH - 140;
export const FIELD_TOP = 110;
export const FIELD_BOTTOM = GAME_HEIGHT - 110;
export const CORNER_RADIUS = 90;
export const WALL_THICKNESS = 24;

export const GOAL_HALF_HEIGHT = 110;
export const GOAL_DEPTH = 90;
export const GOAL_CENTER_Y = (FIELD_TOP + FIELD_BOTTOM) / 2;
export const GOAL_TOP_Y = GOAL_CENTER_Y - GOAL_HALF_HEIGHT;
export const GOAL_BOTTOM_Y = GOAL_CENTER_Y + GOAL_HALF_HEIGHT;

const CORNER_SEGMENTS = 8;

export interface GoalZone {
  team: TeamId;
  /** The team that DEFENDS this goal (scoring here is a goal for the opposite team). */
  defendingTeam: TeamId;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Builds and renders the stadium-shaped soccer pitch: a rounded-corner rectangle
 * border with two goal openings (left and right), plus the goal "pocket" walls.
 */
export class SoccerField {
  private scene: Phaser.Scene;
  readonly leftGoal: GoalZone;
  readonly rightGoal: GoalZone;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.leftGoal = {
      team: "red",
      defendingTeam: "red",
      left: FIELD_LEFT - GOAL_DEPTH,
      right: FIELD_LEFT,
      top: GOAL_TOP_Y,
      bottom: GOAL_BOTTOM_Y,
    };
    this.rightGoal = {
      team: "yellow",
      defendingTeam: "yellow",
      left: FIELD_RIGHT,
      right: FIELD_RIGHT + GOAL_DEPTH,
      top: GOAL_TOP_Y,
      bottom: GOAL_BOTTOM_Y,
    };

    this.buildCollision();
    this.render();
  }

  /** Returns spawn positions (kickoff formation) for a team, index 0..BOTZ_PER_TEAM-1. */
  static spawnPositionsFor(team: TeamId): Point[] {
    const nearX = team === "red" ? FIELD_LEFT + 190 : FIELD_RIGHT - 190;
    const farX = team === "red" ? FIELD_LEFT + 430 : FIELD_RIGHT - 430;
    return [
      { x: nearX, y: GOAL_CENTER_Y },
      { x: farX, y: GOAL_CENTER_Y - 160 },
      { x: farX, y: GOAL_CENTER_Y + 160 },
    ].slice(0, BOTZ_PER_TEAM);
  }

  static ballSpawnPosition(): Point {
    return { x: (FIELD_LEFT + FIELD_RIGHT) / 2, y: GOAL_CENTER_Y };
  }

  /** True once the ball (given its center and radius) is entirely past the goal line. */
  static isFullyInGoal(zone: GoalZone, ballX: number, ballY: number, ballRadius: number): boolean {
    if (ballY - ballRadius < zone.top || ballY + ballRadius > zone.bottom) return false;
    if (zone.team === "red") {
      // Left goal: ball must be entirely left of the goal line (field left edge).
      return ballX + ballRadius < FIELD_LEFT;
    }
    return ballX - ballRadius > FIELD_RIGHT;
  }

  private addSegment(a: Point, b: Point, thickness = WALL_THICKNESS) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const length = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const angle = Phaser.Math.Angle.Between(a.x, a.y, b.x, b.y);
    this.scene.matter.add.rectangle(cx, cy, length + thickness, thickness, {
      isStatic: true,
      angle,
      restitution: WALL_PHYSICS.restitution,
      friction: WALL_PHYSICS.friction,
      label: "wall",
    });
  }

  private arcPoints(center: Point, radius: number, startAngle: number, endAngle: number): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const t = startAngle + ((endAngle - startAngle) * i) / CORNER_SEGMENTS;
      pts.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
    }
    return pts;
  }

  private addPolyline(points: Point[]) {
    for (let i = 0; i < points.length - 1; i++) {
      this.addSegment(points[i], points[i + 1]);
    }
  }

  private buildCollision(): void {
    const r = CORNER_RADIUS;
    const TL = { x: FIELD_LEFT + r, y: FIELD_TOP + r };
    const TR = { x: FIELD_RIGHT - r, y: FIELD_TOP + r };
    const BR = { x: FIELD_RIGHT - r, y: FIELD_BOTTOM - r };
    const BL = { x: FIELD_LEFT + r, y: FIELD_BOTTOM - r };

    // Top edge.
    this.addSegment({ x: TL.x, y: FIELD_TOP }, { x: TR.x, y: FIELD_TOP });
    // Top-right corner.
    this.addPolyline(this.arcPoints(TR, r, -Math.PI / 2, 0));
    // Right edge, split around the goal opening.
    this.addSegment({ x: FIELD_RIGHT, y: TR.y }, { x: FIELD_RIGHT, y: GOAL_TOP_Y });
    this.addSegment({ x: FIELD_RIGHT, y: GOAL_BOTTOM_Y }, { x: FIELD_RIGHT, y: BR.y });
    // Bottom-right corner.
    this.addPolyline(this.arcPoints(BR, r, 0, Math.PI / 2));
    // Bottom edge.
    this.addSegment({ x: BR.x, y: FIELD_BOTTOM }, { x: BL.x, y: FIELD_BOTTOM });
    // Bottom-left corner.
    this.addPolyline(this.arcPoints(BL, r, Math.PI / 2, Math.PI));
    // Left edge, split around the goal opening.
    this.addSegment({ x: FIELD_LEFT, y: BL.y }, { x: FIELD_LEFT, y: GOAL_BOTTOM_Y });
    this.addSegment({ x: FIELD_LEFT, y: GOAL_TOP_Y }, { x: FIELD_LEFT, y: TL.y });
    // Top-left corner.
    this.addPolyline(this.arcPoints(TL, r, Math.PI, (3 * Math.PI) / 2));

    this.buildGoalPocket(this.leftGoal, -1);
    this.buildGoalPocket(this.rightGoal, 1);
  }

  private buildGoalPocket(zone: GoalZone, dir: -1 | 1): void {
    const lineX = dir === -1 ? FIELD_LEFT : FIELD_RIGHT;
    const backX = dir === -1 ? zone.left : zone.right;
    // Top connector.
    this.addSegment({ x: lineX, y: GOAL_TOP_Y }, { x: backX, y: GOAL_TOP_Y });
    // Bottom connector.
    this.addSegment({ x: lineX, y: GOAL_BOTTOM_Y }, { x: backX, y: GOAL_BOTTOM_Y });
    // Back wall.
    this.addSegment({ x: backX, y: GOAL_TOP_Y }, { x: backX, y: GOAL_BOTTOM_Y });
  }

  private render(): void {
    const backdrop = this.scene.add.graphics();
    backdrop.setDepth(-16);
    backdrop.fillGradientStyle(0x0b0f1a, 0x0b0f1a, 0x1a2338, 0x1a2338, 1, 1, 1, 1);
    backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Circuit-board grid: reads as a "tech workshop floor" around the pitch
    // (the pitch fill drawn later covers the part of the grid under it).
    backdrop.lineStyle(1, 0x2a3550, 0.35);
    const gridSize = 64;
    for (let gx = 0; gx <= GAME_WIDTH; gx += gridSize) backdrop.lineBetween(gx, 0, gx, GAME_HEIGHT);
    for (let gy = 0; gy <= GAME_HEIGHT; gy += gridSize) backdrop.lineBetween(0, gy, GAME_WIDTH, gy);
    backdrop.fillStyle(0x38bdf8, 0.22);
    for (let gx = 0; gx <= GAME_WIDTH; gx += gridSize) {
      for (let gy = 0; gy <= GAME_HEIGHT; gy += gridSize) {
        if ((gx / gridSize + gy / gridSize) % 3 === 0) backdrop.fillCircle(gx, gy, 2.2);
      }
    }

    this.drawCornerLights();
    this.drawBleachers();

    // Soft ambient glow behind the pitch, for separation from the backdrop.
    const ambient = this.scene.add.graphics();
    ambient.setDepth(-13);
    ambient.fillStyle(0x22c55e, 0.1);
    this.fillStadium(ambient, -30);

    // Pitch fill (also doubles as the mask shape for the mow stripes below).
    const pitchShape = this.scene.add.graphics();
    pitchShape.setDepth(-12);
    pitchShape.fillGradientStyle(0x3fb459, 0x3fb459, 0x1f7a37, 0x1f7a37, 1, 1, 1, 1);
    this.fillStadium(pitchShape, 0);

    // Alternating mow stripes: a subtle darkening tint over the gradient
    // (not a flat color swap), clipped to the stadium shape via a mask.
    const stripes = this.scene.add.graphics();
    stripes.setDepth(-11);
    stripes.fillStyle(0x000000, 0.07);
    const stripeCount = 8;
    const stripeW = (FIELD_RIGHT - FIELD_LEFT) / stripeCount;
    for (let i = 0; i < stripeCount; i += 2) {
      stripes.fillRect(FIELD_LEFT + i * stripeW, FIELD_TOP, stripeW, FIELD_BOTTOM - FIELD_TOP);
    }
    const maskShape = this.scene.add.graphics();
    maskShape.fillStyle(0xffffff, 1);
    this.fillStadium(maskShape, 0);
    maskShape.setVisible(false);
    stripes.setMask(maskShape.createGeometryMask());

    const g = this.scene.add.graphics();
    g.setDepth(-9);

    // Border: soft outer glow behind a crisp line.
    g.lineStyle(14, 0xf1f5f9, 0.12);
    this.strokeStadium(g, 0);
    g.lineStyle(4, 0xf1f5f9, 0.95);
    this.strokeStadium(g, 0);

    // Center line + circle, with a faint glow to match the border treatment.
    g.lineStyle(9, 0x7dd3fc, 0.1);
    g.lineBetween(GAME_WIDTH / 2, FIELD_TOP, GAME_WIDTH / 2, FIELD_BOTTOM);
    g.strokeCircle(GAME_WIDTH / 2, GOAL_CENTER_Y, 90);
    g.lineStyle(3.5, 0xf1f5f9, 0.6);
    g.lineBetween(GAME_WIDTH / 2, FIELD_TOP, GAME_WIDTH / 2, FIELD_BOTTOM);
    g.strokeCircle(GAME_WIDTH / 2, GOAL_CENTER_Y, 90);
    g.fillStyle(0xf1f5f9, 0.6);
    g.fillCircle(GAME_WIDTH / 2, GOAL_CENTER_Y, 4);

    // Goal pockets + net hatch.
    this.drawGoalPocket(g, this.leftGoal, -1);
    this.drawGoalPocket(g, this.rightGoal, 1);
    this.drawGoalNet(this.leftGoal);
    this.drawGoalNet(this.rightGoal);
  }

  private stadiumPath(g: Phaser.GameObjects.Graphics, inset: number): void {
    const r = CORNER_RADIUS - inset;
    const left = FIELD_LEFT + inset;
    const right = FIELD_RIGHT - inset;
    const top = FIELD_TOP + inset;
    const bottom = FIELD_BOTTOM - inset;
    g.arc(left + r, top + r, r, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(270));
    g.lineTo(right - r, top);
    g.arc(right - r, top + r, r, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(360));
    g.lineTo(right, bottom - r);
    g.arc(right - r, bottom - r, r, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(90));
    g.lineTo(left + r, bottom);
    g.arc(left + r, bottom - r, r, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(180));
    g.lineTo(left, top + r);
  }

  private fillStadium(g: Phaser.GameObjects.Graphics, inset: number): void {
    g.beginPath();
    this.stadiumPath(g, inset);
    g.closePath();
    g.fillPath();
  }

  private strokeStadium(g: Phaser.GameObjects.Graphics, inset: number): void {
    g.beginPath();
    this.stadiumPath(g, inset);
    g.closePath();
    g.strokePath();
  }

  /** Small glowing floodlight orbs tucked into the four corners of the screen. */
  private drawCornerLights(): void {
    const g = this.scene.add.graphics();
    g.setDepth(-14.5); // above the bleachers (-15), so the glow isn't clipped by their fill
    const inset = 26;
    const corners: Point[] = [
      { x: inset, y: inset },
      { x: GAME_WIDTH - inset, y: inset },
      { x: inset, y: GAME_HEIGHT - inset },
      { x: GAME_WIDTH - inset, y: GAME_HEIGHT - inset },
    ];
    for (const c of corners) {
      g.fillStyle(0x7dd3fc, 0.14);
      g.fillCircle(c.x, c.y, 50);
      g.fillStyle(0xe0f2fe, 0.55);
      g.fillCircle(c.x, c.y, 11);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(c.x, c.y, 4);
    }
  }

  /**
   * A full ring of stands around the pitch — top, bottom, and (new) side
   * stands directly behind each goal — populated with tiny robot spectators.
   * Side sections skew towards that goal's team color, like a home end.
   */
  private drawBleachers(): void {
    const g = this.scene.add.graphics();
    g.setDepth(-15);
    const tiers = 3;

    // Top / bottom stands span the full width.
    const topTierH = FIELD_TOP / tiers;
    for (let i = 0; i < tiers; i++) {
      const y1 = FIELD_TOP - i * topTierH;
      const y0 = y1 - topTierH;
      this.drawTierBand(g, 0, GAME_WIDTH, y0, y1 - 3, i);
      this.scatterSpectators(g, 12, GAME_WIDTH - 12, y0 + topTierH * 0.58, i, "mixed");
    }
    const bottomTierH = (GAME_HEIGHT - FIELD_BOTTOM) / tiers;
    for (let i = 0; i < tiers; i++) {
      const y0 = FIELD_BOTTOM + i * bottomTierH;
      this.drawTierBand(g, 0, GAME_WIDTH, y0 + 3, y0 + bottomTierH, i);
      this.scatterSpectators(g, 12, GAME_WIDTH - 12, y0 + bottomTierH * 0.42, i, "mixed");
    }

    // Side stands, directly behind each goal, tinted for that team's fans.
    const sideTierW = FIELD_LEFT / tiers;
    for (let i = 0; i < tiers; i++) {
      const x1 = FIELD_LEFT - i * sideTierW;
      const x0 = x1 - sideTierW;
      this.drawTierBandVertical(g, x0, x1 - 3, FIELD_TOP, FIELD_BOTTOM, i);
      this.scatterSpectatorsVertical(g, x0 + sideTierW * 0.58, FIELD_TOP + 12, FIELD_BOTTOM - 12, i, "red");
    }
    for (let i = 0; i < tiers; i++) {
      const x0 = FIELD_RIGHT + i * sideTierW;
      this.drawTierBandVertical(g, x0 + 3, x0 + sideTierW, FIELD_TOP, FIELD_BOTTOM, i);
      this.scatterSpectatorsVertical(g, x0 + sideTierW * 0.42, FIELD_TOP + 12, FIELD_BOTTOM - 12, i, "yellow");
    }
  }

  /** One horizontal tier band (top/bottom stands), closest-to-pitch tier brightest. */
  private drawTierBand(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y0: number, y1: number, tierIndex: number): void {
    const palette = [0x35456e, 0x25304e, 0x171f36];
    g.fillStyle(palette[tierIndex], 1);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle(0x7dd3fc, 0.28 - tierIndex * 0.06);
    g.fillRect(x0, y1 - 2, x1 - x0, 2);
  }

  /** One vertical tier band (side stands behind a goal). */
  private drawTierBandVertical(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y0: number, y1: number, tierIndex: number): void {
    const palette = [0x35456e, 0x25304e, 0x171f36];
    g.fillStyle(palette[tierIndex], 1);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle(0x7dd3fc, 0.28 - tierIndex * 0.06);
    g.fillRect(x1 - 2, y0, 2, y1 - y0);
  }

  private spectatorColor(i: number, tierIndex: number, theme: "mixed" | "red" | "yellow"): number {
    const mixed = [0x94a3b8, 0x64748b, 0x94a3b8, 0x64748b, 0xef4444, 0x94a3b8, 0x64748b, 0xf5c518];
    const red = [0xef4444, 0x94a3b8, 0xdc2626, 0xef4444, 0x64748b, 0xef4444];
    const yellow = [0xf5c518, 0x94a3b8, 0xeab308, 0xf5c518, 0x64748b, 0xf5c518];
    const palette = theme === "red" ? red : theme === "yellow" ? yellow : mixed;
    return palette[(i + tierIndex * 3) % palette.length];
  }

  /** One tiny robot-spectator dot with a soft ground shadow and a bright "eye". */
  private drawSpectator(g: Phaser.GameObjects.Graphics, px: number, py: number, r: number, color: number, alpha: number): void {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(px, py + r * 0.9, r * 1.6, r * 0.7);
    g.fillStyle(color, alpha);
    g.fillCircle(px, py, r);
    g.fillStyle(0x7dd3fc, 0.9);
    g.fillCircle(px, py - r * 0.15, r * 0.3);
  }

  /** Deterministic pseudo-scatter (no RNG) so the crowd looks lively but stable — horizontal stands. */
  private scatterSpectators(
    g: Phaser.GameObjects.Graphics,
    xStart: number,
    xEnd: number,
    y: number,
    tierIndex: number,
    theme: "mixed" | "red" | "yellow",
  ): void {
    const spacing = 26;
    let i = 0;
    for (let x = xStart; x <= xEnd; x += spacing, i++) {
      const jitterX = ((i * 37) % 11) - 5;
      const jitterY = ((i * 19) % 7) - 3;
      const r = 5.5 - tierIndex * 0.7;
      this.drawSpectator(g, x + jitterX, y + jitterY, r, this.spectatorColor(i, tierIndex, theme), 0.92 - tierIndex * 0.1);
    }
  }

  /** Same as scatterSpectators, but scattered down a vertical column (side stands). */
  private scatterSpectatorsVertical(
    g: Phaser.GameObjects.Graphics,
    x: number,
    yStart: number,
    yEnd: number,
    tierIndex: number,
    theme: "mixed" | "red" | "yellow",
  ): void {
    const spacing = 24;
    let i = 0;
    for (let y = yStart; y <= yEnd; y += spacing, i++) {
      const jitterY = ((i * 37) % 11) - 5;
      const jitterX = ((i * 19) % 7) - 3;
      const r = 5 - tierIndex * 0.6;
      this.drawSpectator(g, x + jitterX, y + jitterY, r, this.spectatorColor(i, tierIndex, theme), 0.9 - tierIndex * 0.1);
    }
  }

  /** Diagonal net hatch inside a goal box, clipped to its bounds via a geometry mask. */
  private drawGoalNet(zone: GoalZone): void {
    const x0 = zone.left;
    const y0 = zone.top;
    const w = zone.right - zone.left;
    const h = zone.bottom - zone.top;
    const spacing = 15;

    const hatch = this.scene.add.graphics();
    hatch.setDepth(-8);
    hatch.lineStyle(1.5, 0xffffff, 0.15);
    for (let offset = -h; offset < w; offset += spacing) {
      hatch.lineBetween(x0 + offset, y0, x0 + offset + h, y0 + h);
    }
    for (let offset = 0; offset < w + h; offset += spacing) {
      hatch.lineBetween(x0 + offset, y0, x0 + offset - h, y0 + h);
    }

    const maskRect = this.scene.add.graphics();
    maskRect.fillStyle(0xffffff, 1);
    maskRect.fillRect(x0, y0, w, h);
    maskRect.setVisible(false);
    hatch.setMask(maskRect.createGeometryMask());
  }

  private drawGoalPocket(g: Phaser.GameObjects.Graphics, zone: GoalZone, dir: -1 | 1): void {
    const color = TEAM_COLORS[zone.team];
    const lineX = dir === -1 ? FIELD_LEFT : FIELD_RIGHT;
    const backX = dir === -1 ? zone.left : zone.right;

    g.fillStyle(color, 0.18);
    g.fillRect(zone.left, zone.top, zone.right - zone.left, zone.bottom - zone.top);

    // Outer glow perimeter, then a crisp frame — same "neon" treatment as the pitch border.
    g.lineStyle(9, color, 0.14);
    g.strokeRect(zone.left, zone.top, zone.right - zone.left, zone.bottom - zone.top);
    g.lineStyle(4, color, 0.9);
    g.lineBetween(lineX, zone.top, backX, zone.top);
    g.lineBetween(lineX, zone.bottom, backX, zone.bottom);
    g.lineBetween(backX, zone.top, backX, zone.bottom);

    // HUD-style corner brackets at all four corners of the box.
    this.drawCornerBracket(g, lineX, zone.top, dir, 1, color);
    this.drawCornerBracket(g, lineX, zone.bottom, dir, -1, color);
    this.drawCornerBracket(g, backX, zone.top, -dir, 1, color);
    this.drawCornerBracket(g, backX, zone.bottom, -dir, -1, color);

    // Gate pylons flanking the goal mouth.
    this.drawGatePylon(g, lineX, zone.top, color);
    this.drawGatePylon(g, lineX, zone.bottom, color);
  }

  private drawCornerBracket(g: Phaser.GameObjects.Graphics, x: number, y: number, dx: number, dy: number, color: number): void {
    const len = 18;
    g.lineStyle(3, 0xffffff, 0.7);
    g.lineBetween(x, y, x + dx * len, y);
    g.lineBetween(x, y, x, y + dy * len);
    g.lineStyle(1.5, color, 1);
    g.lineBetween(x, y, x + dx * len, y);
    g.lineBetween(x, y, x, y + dy * len);
  }

  private drawGatePylon(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    const w = 9;
    const h = 24;
    g.fillStyle(0x0f172a, 0.5);
    g.fillCircle(x, y, 16);
    g.fillStyle(shade(color, -30), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    g.fillStyle(color, 0.35);
    g.fillCircle(x, y, 11);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(x, y, 4);
  }
}
