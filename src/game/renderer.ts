import type { ThemeTokens } from '../theme';
import type { Road } from './road';
import type { Vehicle } from './vehicle';

/** How far ahead of the player the visible road extends, in meters. */
const VIEW_METERS = 24;
/** Row samples down the screen so bends render smoothly. */
const SAMPLES = 64;
const DASH_METERS = 6;
const DASH_ON = 3; // meters painted, alternating with 3m gaps

interface Row {
  cx: number;
  half: number;
  y: number;
  /** World meters of this row above the player. */
  ahead: number;
}

/** Strict top-down 2D render: no rotation, no tilt. Road scrolls down the Y axis. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tokens: ThemeTokens,
  road: Road,
  vehicle: Vehicle,
): void {
  ctx.fillStyle = tokens.surfaceBase;
  ctx.fillRect(0, 0, width, height);

  // Sample the road center down the screen so bends render smoothly while
  // shoulders and lane lines stay exactly parallel to the center.
  const rows: Row[] = [];
  const half = road.halfWidth(width);
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const ahead = (1 - t) * VIEW_METERS;
    rows.push({ cx: road.centerXAt(road.scroll + ahead, width), half, y: t * height, ahead });
  }

  const shoulder = 14;

  // Shoulder band (drawn first, beneath asphalt)
  ctx.fillStyle = tokens.surfaceBaseGlow;
  for (let i = 0; i < SAMPLES; i++) {
    quad(ctx, rows[i], rows[i + 1], half + shoulder);
  }

  // Asphalt
  ctx.fillStyle = tokens.surfaceRoad;
  for (let i = 0; i < SAMPLES; i++) {
    quad(ctx, rows[i], rows[i + 1], half);
  }

  drawLaneMarkers(ctx, rows, road, tokens);
  drawEdges(ctx, rows, shoulder, tokens);
  drawVehicle(ctx, width, height, road, vehicle, tokens);
}

function quad(
  ctx: CanvasRenderingContext2D,
  a: Row,
  b: Row,
  halfExtent: number,
): void {
  ctx.beginPath();
  ctx.moveTo(a.cx - halfExtent, a.y);
  ctx.lineTo(a.cx + halfExtent, a.y);
  ctx.lineTo(b.cx + halfExtent, b.y);
  ctx.lineTo(b.cx - halfExtent, b.y);
  ctx.closePath();
  ctx.fill();
}

function drawLaneMarkers(
  ctx: CanvasRenderingContext2D,
  rows: Row[],
  road: Road,
  tokens: ThemeTokens,
): void {
  const lanes = 3;
  const cycle = DASH_METERS * 2;
  for (let i = 1; i < lanes; i++) {
    const frac = i / lanes;
    const color = i === 1 ? tokens.accentWarning : tokens.surfaceRoadMark;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    for (let k = 0; k < rows.length - 1; k++) {
      const a = rows[k];
      const b = rows[k + 1];
      // Dash phase from absolute world position (scroll + ahead) so dashes
      // are anchored to the road, not the screen.
      const phaseA = (road.scrollAbs + a.ahead) % cycle;
      const phaseB = (road.scrollAbs + b.ahead) % cycle;
      const onA = phaseA < DASH_ON;
      const onB = phaseB < DASH_ON;
      if (onA && onB) {
        stripe(ctx, a, b, frac);
      } else if (onA !== onB) {
        // Dash boundary inside this row: paint the on-part proportionally.
        const f = onA ? (DASH_ON - phaseA) / (phaseB - phaseA) : (cycle - phaseA) / (phaseB - phaseA);
        const clamped = Math.max(0, Math.min(1, f));
        const from = onA ? a : b;
        const to: Row = {
          cx: a.cx + (b.cx - a.cx) * clamped,
          half: a.half + (b.half - a.half) * clamped,
          y: a.y + (b.y - a.y) * clamped,
          ahead: 0,
        };
        stripe(ctx, from, to, frac);
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawEdges(ctx: CanvasRenderingContext2D, rows: Row[], shoulder: number, tokens: ThemeTokens): void {
  // Solid edge lines parallel to the center, following the same sampled rows.
  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < rows.length - 1; k++) {
    const a = rows[k];
    const b = rows[k + 1];
    ctx.beginPath();
    ctx.moveTo(a.cx - a.half - 2, a.y);
    ctx.lineTo(a.cx - a.half, a.y);
    ctx.lineTo(b.cx - b.half, b.y);
    ctx.lineTo(b.cx - b.half - 2, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(a.cx + a.half, a.y);
    ctx.lineTo(a.cx + a.half + 2, a.y);
    ctx.lineTo(b.cx + b.half + 2, b.y);
    ctx.lineTo(b.cx + b.half, b.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Rumble hatching on the shoulders
  ctx.fillStyle = tokens.uiOverlayMuted;
  ctx.globalAlpha = 0.25;
  const hatchW = 8;
  for (let k = 0; k < rows.length - 1; k += 4) {
    const a = rows[k];
    const b = rows[Math.min(k + 4, rows.length - 1)];
    ctx.beginPath();
    ctx.moveTo(a.cx - a.half - shoulder, a.y);
    ctx.lineTo(a.cx - a.half - shoulder + hatchW, a.y);
    ctx.lineTo(b.cx - b.half - shoulder + hatchW, b.y);
    ctx.lineTo(b.cx - b.half - shoulder, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(a.cx + a.half + shoulder - hatchW, a.y);
    ctx.lineTo(a.cx + a.half + shoulder, a.y);
    ctx.lineTo(b.cx + b.half + shoulder, b.y);
    ctx.lineTo(b.cx + b.half + shoulder - hatchW, b.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function stripe(ctx: CanvasRenderingContext2D, a: Row, b: Row, frac: number): void {
  const ax = a.cx + (2 * frac - 1) * a.half;
  const bx = b.cx + (2 * frac - 1) * b.half;
  ctx.beginPath();
  ctx.moveTo(ax - 2, a.y);
  ctx.lineTo(ax + 2, a.y);
  ctx.lineTo(bx + 2, b.y);
  ctx.lineTo(bx - 2, b.y);
  ctx.closePath();
  ctx.fill();
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  road: Road,
  vehicle: Vehicle,
  tokens: ThemeTokens,
): void {
  const w = 30;
  const h = 52;
  // Rumble shake while off-road — positional jitter only, never rotation.
  const rumbleX = vehicle.offRoad ? (Math.random() - 0.5) * 4 : 0;
  const rumbleY = vehicle.offRoad ? (Math.random() - 0.5) * 3 : 0;
  const cx = road.centerX(width) + vehicle.offset + rumbleX;
  const cy = height * 0.75 + rumbleY;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.fillStyle = tokens.accentPrimaryGlow;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.9, w * 0.85, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = tokens.accentPrimary;
  roundRect(ctx, x, y, w, h, 7);
  ctx.fill();

  ctx.fillStyle = tokens.surfaceBase;
  roundRect(ctx, x + 5, y + 12, w - 10, 16, 3);
  ctx.fill();

  const tailGlow = vehicle.offRoad ? tokens.accentDanger : tokens.accentWarning;
  ctx.fillStyle = tailGlow;
  ctx.fillRect(x + 3, y + h - 5, 6, 3);
  ctx.fillRect(x + w - 9, y + h - 5, 6, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
