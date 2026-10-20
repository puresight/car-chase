import type { ThemeTokens } from '../theme';
import type { Road } from './road';
import type { Vehicle } from './vehicle';

const SHOULDER_W = 4;
const CAR_W = 30;
const CAR_H = 52;
const DASH_LEN = 26;
const DASH_GAP = 22;
const DASH_W = 4;

/**
 * Waypoint-spline renderer. Strict top-down 2D: the road is one continuous
 * path traced along the node edges; no rotation, no tilt.
 */
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

  const nodes = road.nodes;
  if (nodes.length < 2) return;

  // Road surface: one continuous path up the left edges, across the top,
  // down the right edges, closed.
  ctx.fillStyle = tokens.surfaceRoad;
  ctx.beginPath();
  ctx.moveTo(nodes[0].centerX - nodes[0].roadWidth / 2, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].centerX - nodes[i].roadWidth / 2, nodes[i].y);
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    ctx.lineTo(nodes[i].centerX + nodes[i].roadWidth / 2, nodes[i].y);
  }
  ctx.closePath();
  ctx.fill();

  drawShoulders(ctx, nodes, tokens);
  drawLaneMarkings(ctx, nodes, scrollPx, tokens);
  drawVehicle(ctx, height, vehicle, tokens);
}

function drawShoulders(
  ctx: CanvasRenderingContext2D,
  nodes: RoadNode[],
  tokens: ThemeTokens,
): void {
  ctx.strokeStyle = tokens.accentDanger;
  ctx.lineWidth = SHOULDER_W;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(nodes[0].centerX - nodes[0].roadWidth / 2, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].centerX - nodes[i].roadWidth / 2, nodes[i].y);
  }
  ctx.moveTo(nodes[0].centerX + nodes[0].roadWidth / 2, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].centerX + nodes[i].roadWidth / 2, nodes[i].y);
  }
  ctx.stroke();
}

// Local structural type to avoid a circular import.
interface RoadNode {
  y: number;
  centerX: number;
  roadWidth: number;
}

function drawLaneMarkings(
  ctx: CanvasRenderingContext2D,
  nodes: RoadNode[],
  scrollPx: number,
  tokens: ThemeTokens,
): void {
  const cycle = DASH_LEN + DASH_GAP;
  const phase = scrollPx % cycle;
  const firstDashTop = nodes[0].y + phase - cycle;

  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.9;
  for (let lane = 1; lane < 3; lane++) {
    const frac = lane / 3;
    for (let dashTop = firstDashTop; dashTop < nodes[nodes.length - 1].y; dashTop += cycle) {
      const dashBottom = dashTop + DASH_LEN;
      const top = sampleNode(nodes, dashTop);
      const bottom = sampleNode(nodes, dashBottom);
      const x0 = top.centerX + (2 * frac - 1) * (top.roadWidth / 2);
      const x1 = bottom.centerX + (2 * frac - 1) * (bottom.roadWidth / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.min(x0, x1) - DASH_W, dashTop, Math.abs(x1 - x0) + DASH_W * 2, DASH_LEN);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x0 - DASH_W / 2, dashTop);
      ctx.lineTo(x0 + DASH_W / 2, dashTop);
      ctx.lineTo(x1 + DASH_W / 2, dashBottom);
      ctx.lineTo(x1 - DASH_W / 2, dashBottom);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function sampleNode(nodes: RoadNode[], y: number): RoadNode {
  if (y <= nodes[0].y) return nodes[0];
  const last = nodes[nodes.length - 1];
  if (y >= last.y) return last;
  let i = 1;
  while (i < nodes.length && nodes[i].y < y) i++;
  const a = nodes[i - 1];
  const b = nodes[i];
  const t = (y - a.y) / (b.y - a.y);
  return {
    y,
    centerX: a.centerX + (b.centerX - a.centerX) * t,
    roadWidth: a.roadWidth + (b.roadWidth - a.roadWidth) * t,
  };
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
