import type { ThemeTokens } from '../theme';
import type { Road } from './road';
import type { Vehicle } from './vehicle';

const SHOULDER_W = 4;
const CAR_W = 30;
const CAR_H = 52;
const DASH_LEN = 26;
const DASH_GAP = 22;
const DASH_W = 4;
/** Horizontal scan step for the road surface polygon. */
const SCAN_STEP = 16;

/** Scanline-sampled Bézier highway renderer. Strict top-down 2D, no tilt. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tokens: ThemeTokens,
  road: Road,
  vehicle: Vehicle,
  scrollPx: number,
): void {
  // Grass/terrain
  ctx.fillStyle = tokens.surfaceBase;
  ctx.fillRect(0, 0, width, height);

  if (road.points.length < 4) return;

  // Road surface: a solid polygon traced at SCAN_STEP resolution.
  ctx.fillStyle = tokens.surfaceRoad;
  ctx.beginPath();
  let first = true;
  let y = 0;
  while (y <= height) {
    const cx = road.centerXAtY(y);
    const half = road.roadWidth / 2;
    const left = cx - half;
    if (first) {
      ctx.moveTo(left, y);
      first = false;
    } else {
      ctx.lineTo(left, y);
    }
    y += SCAN_STEP;
  }
  y = height;
  while (y >= 0) {
    const cx = road.centerXAtY(y);
    const half = road.roadWidth / 2;
    ctx.lineTo(cx + half, y);
    y -= SCAN_STEP;
  }
  ctx.closePath();
  ctx.fill();

  drawShoulders(ctx, road, height, tokens);
  drawLaneMarkings(ctx, road, height, scrollPx, tokens);
  drawVehicle(ctx, height, vehicle, tokens);
}

function drawShoulders(
  ctx: CanvasRenderingContext2D,
  road: Road,
  height: number,
  tokens: ThemeTokens,
): void {
  ctx.strokeStyle = tokens.accentDanger;
  ctx.lineWidth = SHOULDER_W;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  let y = 0;
  while (y <= height) {
    const cx = road.centerXAtY(y);
    const half = road.roadWidth / 2;
    const left = cx - half;
    if (y === 0) ctx.moveTo(left, y);
    else ctx.lineTo(left, y);
    y += SCAN_STEP;
  }
  ctx.stroke();

  ctx.beginPath();
  y = 0;
  while (y <= height) {
    const cx = road.centerXAtY(y);
    const half = road.roadWidth / 2;
    const right = cx + half;
    if (y === 0) ctx.moveTo(right, y);
    else ctx.lineTo(right, y);
    y += SCAN_STEP;
  }
  ctx.stroke();
}

function drawLaneMarkings(
  ctx: CanvasRenderingContext2D,
  road: Road,
  height: number,
  scrollPx: number,
  tokens: ThemeTokens,
): void {
  const cycle = DASH_LEN + DASH_GAP;
  const phase = scrollPx % cycle;

  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.9;
  for (let lane = 1; lane < 3; lane++) {
    const frac = lane / 3;
    const lateral = (2 * frac - 1) * (road.roadWidth / 2);

    for (let dashTop = phase - cycle; dashTop < height; dashTop += cycle) {
      const dashBottom = dashTop + DASH_LEN;
      const row = Math.min(height, dashBottom);
      if (row <= dashTop) continue;

      const cxTop = road.centerXAtY(Math.max(0, dashTop));
      const cxBot = road.centerXAtY(row);
      const x0 = cxTop + lateral;
      const x1 = cxBot + lateral;

      ctx.beginPath();
      ctx.moveTo(x0 - DASH_W / 2, dashTop);
      ctx.lineTo(x0 + DASH_W / 2, dashTop);
      ctx.lineTo(x1 + DASH_W / 2, row);
      ctx.lineTo(x1 - DASH_W / 2, row);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  height: number,
  vehicle: Vehicle,
  tokens: ThemeTokens,
): void {
  const cx = vehicle.x;
  const cy = height * 0.75;
  const x = cx - CAR_W / 2;
  const y = cy - CAR_H / 2;

  ctx.fillStyle = tokens.accentPrimaryGlow;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(cx, y + CAR_H * 0.9, CAR_W * 0.85, CAR_H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = tokens.accentPrimary;
  roundRect(ctx, x, y, CAR_W, CAR_H, 7);
  ctx.fill();

  ctx.fillStyle = tokens.surfaceBase;
  roundRect(ctx, x + 5, y + 12, CAR_W - 10, 16, 3);
  ctx.fill();

  const tailGlow = vehicle.offRoad ? tokens.accentDanger : tokens.accentWarning;
  ctx.fillStyle = tailGlow;
  ctx.fillRect(x + 3, y + CAR_H - 5, 6, 3);
  ctx.fillRect(x + CAR_W - 9, y + CAR_H - 5, 6, 3);
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
