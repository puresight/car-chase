import type { ThemeTokens } from '../theme';
import type { Road } from './road';
import type { Vehicle } from './vehicle';

const METER_PX = 3.2;

export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tokens: ThemeTokens,
  road: Road,
  vehicle: Vehicle,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = tokens.surfaceBase;
  ctx.fillRect(0, 0, width, height);

  const cx = road.centerX(width);
  const half = road.halfWidth(width);
  const shoulder = 14;

  ctx.fillStyle = tokens.surfaceBaseGlow;
  ctx.fillRect(cx - half - shoulder, 0, (half + shoulder) * 2, height);
  ctx.fillStyle = tokens.surfaceRoad;
  ctx.fillRect(cx - half, 0, half * 2, height);

  drawLaneMarkers(ctx, cx, half, road.scroll, height, tokens);
  drawEdges(ctx, cx, half, shoulder, height, tokens);
  drawVehicle(ctx, height, vehicle, tokens);
}

function drawLaneMarkers(
  ctx: CanvasRenderingContext2D,
  cx: number,
  half: number,
  scroll: number,
  height: number,
  tokens: ThemeTokens,
): void {
  const lanes = 3;
  const dashH = 26;
  const gap = 22;
  const cycle = dashH + gap;
  const offset = (scroll * METER_PX) % cycle;

  for (let i = 1; i < lanes; i++) {
    const x = cx - half + (half * 2 * i) / lanes;
    const color = i === 1 ? tokens.accentWarning : tokens.surfaceRoadMark;
    ctx.fillStyle = color;
    ctx.globalAlpha = i === 1 ? 0.85 : 0.9;
    for (let y = -cycle + offset; y < height; y += cycle) {
      ctx.fillRect(x - 2, y, 4, dashH);
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.9;
  for (let y = -cycle + offset; y < height; y += cycle) {
    ctx.fillRect(cx - 1.5, y, 3, dashH);
  }
  ctx.globalAlpha = 1;
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  cx: number,
  half: number,
  shoulder: number,
  height: number,
  tokens: ThemeTokens,
): void {
  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(cx - half - 2, 0, 2, height);
  ctx.fillRect(cx + half, 0, 2, height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = tokens.uiOverlayMuted;
  ctx.globalAlpha = 0.25;
  const hatchW = 8;
  for (let y = 0; y < height; y += 18) {
    ctx.fillRect(cx - half - shoulder, y, hatchW, 9);
    ctx.fillRect(cx + half + shoulder - hatchW, y + 9, hatchW, 9);
  }
  ctx.globalAlpha = 1;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  height: number,
  vehicle: Vehicle,
  tokens: ThemeTokens,
): void {
  const w = 30;
  const h = 52;
  const x = vehicle.x - w / 2;
  const y = height * 0.8 - h / 2;

  ctx.fillStyle = tokens.accentPrimaryGlow;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(vehicle.x, y + h * 0.9, w * 0.85, h * 0.28, 0, 0, Math.PI * 2);
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

  const tilt = Math.max(-0.18, Math.min(0.18, vehicle.vx / 900));
  ctx.translate(vehicle.x, y + h / 2);
  ctx.rotate(tilt);
  ctx.translate(-vehicle.x, -(y + h / 2));
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
