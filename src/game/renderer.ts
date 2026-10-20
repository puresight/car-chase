import type { ThemeTokens } from '../theme';
import type { Road } from './road';
import type { Vehicle } from './vehicle';

/** How far ahead of the player the visible road extends, in meters. */
const VIEW_METERS = 24;
/** Vertical slice resolution for the road surface. */
const SURFACE_STEPS = 32;
/** Vertical slice resolution for lane stripes. */
const STRIPE_STEPS = 64;
const DASH_METERS = 6;
const DASH_ON = 3;
const STRIPE_HALF_W = 2;
const SHOULDER_PX = 14;

interface Slice {
  cx: number;
  half: number;
  y: number;
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

  const slices: Slice[] = [];
  const half = road.halfWidth(width);
  for (let i = 0; i <= SURFACE_STEPS; i++) {
    const t = i / SURFACE_STEPS;
    const ahead = (1 - t) * VIEW_METERS;
    slices.push({
      cx: road.centerXAt(road.scroll + ahead, width),
      half,
      y: t * height,
    });
  }

  // Shoulder band (drawn first, beneath asphalt)
  ctx.fillStyle = tokens.surfaceBaseGlow;
  for (let i = 0; i < SURFACE_STEPS; i++) {
    quad(ctx, slices[i], slices[i + 1], half + SHOULDER_PX);
  }

  // Asphalt
  ctx.fillStyle = tokens.surfaceRoad;
  for (let i = 0; i < SURFACE_STEPS; i++) {
    quad(ctx, slices[i], slices[i + 1], half);
  }

  // Solid edge lines riding the asphalt boundary of every slice
  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < SURFACE_STEPS; i++) {
    edgeQuad(ctx, slices[i], slices[i + 1], half - STRIPE_HALF_W, half);
    edgeQuad(ctx, slices[i], slices[i + 1], -half, -half + STRIPE_HALF_W);
  }
  ctx.globalAlpha = 1;

  drawLaneDividers(ctx, road, width, height, half, tokens);
  drawVehicle(ctx, width, height, road, vehicle, tokens);
}

function quad(
  ctx: CanvasRenderingContext2D,
  a: Slice,
  b: Slice,
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

function edgeQuad(
  ctx: CanvasRenderingContext2D,
  a: Slice,
  b: Slice,
  from: number,
  to: number,
): void {
  ctx.beginPath();
  ctx.moveTo(a.cx + from, a.y);
  ctx.lineTo(a.cx + to, a.y);
  ctx.lineTo(b.cx + to, b.y);
  ctx.lineTo(b.cx + from, b.y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Dashed lane dividers. The dash pattern is anchored to world distance, and
 * each stripe segment follows the center-line offset of its slices so the
 * striping bends naturally with the road.
 */
function drawLaneDividers(
  ctx: CanvasRenderingContext2D,
  road: Road,
  width: number,
  height: number,
  half: number,
  tokens: ThemeTokens,
): void {
  const lanes = 3;
  const cycle = DASH_METERS * 2;
  ctx.fillStyle = tokens.surfaceRoadMark;

  for (let lane = 1; lane < lanes; lane++) {
    const lateral = (2 * (lane / lanes) - 1) * half;
    ctx.globalAlpha = 0.9;

    for (let k = 0; k < STRIPE_STEPS; k++) {
      const t0 = k / STRIPE_STEPS;
      const t1 = (k + 1) / STRIPE_STEPS;
      const s0 = road.scroll + (1 - t0) * VIEW_METERS;
      const s1 = road.scroll + (1 - t1) * VIEW_METERS;
      if (!inDash(s0, s1, cycle)) continue;

      const y0 = t0 * height;
      const y1 = t1 * height;
      const x0 = road.centerXAt(s0, width) + lateral;
      const x1 = road.centerXAt(s1, width) + lateral;
      ctx.fillRect(
        Math.min(x0, x1) - STRIPE_HALF_W,
        y0,
        Math.abs(x1 - x0) + STRIPE_HALF_W * 2,
        y1 - y0,
      );
    }
    ctx.globalAlpha = 1;
  }
}

function inDash(s0: number, s1: number, cycle: number): boolean {
  const p0 = s0 % cycle;
  const p1 = s1 % cycle;
  if (p1 >= p0) return p0 < DASH_ON;
  // Wrapped across a cycle boundary: on if either side is in the dash window.
  return p0 < DASH_ON || p1 < DASH_ON;
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
