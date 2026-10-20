export type SegKind = 'straight' | 'left' | 'right';

export interface RoadPoint {
  y: number;
  x: number;
}

const SPACING = 40;
/** Road edges must stay at least this far inside the canvas boundary. */
const EDGE_INSET = 20;
const ROAD_WIDTH_FRACTION = 0.65;
/** Lateral excursion of a bend, as a fraction of canvas width. */
const BEND_FRACTION = 0.16;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Standard Catmull-Rom — a cubic spline passing through all control points with C1 continuity. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Pure Bézier-spline highway. The road is a sequence of control points
 * (spaced 40px) through which a Catmull-Rom spline is drawn, yielding a
 * continuous curved road with no kinks. Generation is driven by segment
 * types: 60% straight, 20% sweeping left, 20% sweeping right.
 */
export class Road {
  points: RoadPoint[] = [];
  width = 0;
  height = 0;
  roadWidth = 0;

  private segLengthPx = 0;
  private segProgressPx = 0;
  private segStartX = 0;
  private segTargetX = 0;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.roadWidth = width * ROAD_WIDTH_FRACTION;

    const startY = -2 * SPACING;
    const count = Math.ceil((height + 4 * SPACING) / SPACING) + 1;
    const cx = this.clampCenter(width / 2);
    this.points = [];
    for (let i = 0; i <= count; i++) {
      this.points.push({ y: startY + i * SPACING, x: cx });
    }
    this.startSegment('straight', cx, width / 2);
  }

  private clampCenter(x: number): number {
    const min = this.roadWidth / 2 + EDGE_INSET;
    const max = this.width - this.roadWidth / 2 - EDGE_INSET;
    return clamp(x, min, max);
  }

  private startSegment(kind: SegKind, currentX: number, widthCenter: number): void {
    this.segStartX = currentX;
    this.segProgressPx = 0;
    if (kind === 'straight') {
      this.segLengthPx = rand(800, 1400);
      this.segTargetX = currentX;
    } else {
      this.segLengthPx = rand(600, 1000);
      const offset = this.width * BEND_FRACTION;
      this.segTargetX = this.clampCenter(widthCenter + (kind === 'left' ? -offset : offset));
    }
  }

  private pickKind(currentX: number): SegKind {
    const center = this.width / 2;
    const drift = (currentX - center) / (this.width / 4);
    let pLeft = 0.2;
    let pRight = 0.2;
    if (drift > 0.15) {
      pLeft = 0.4;
      pRight = 0.05;
    } else if (drift < -0.15) {
      pRight = 0.4;
      pLeft = 0.05;
    }
    const r = Math.random();
    if (r < pLeft) return 'left';
    if (r < pLeft + pRight) return 'right';
    return 'straight';
  }

  advance(dt: number, pxSpeed: number): void {
    const dy = pxSpeed * dt;
    if (dy <= 0) return;

    for (const p of this.points) p.y += dy;
    this.segProgressPx += dy;

    while (this.points[this.points.length - 1].y > this.height + 2 * SPACING) {
      const recycled = this.points.pop()!;
      recycled.y = this.points[0].y - SPACING;

      if (this.segProgressPx >= this.segLengthPx) {
        const currentX = this.points[0].x;
        this.startSegment(this.pickKind(currentX), currentX, this.width / 2);
      }
      const progress = clamp(this.segProgressPx / this.segLengthPx, 0, 1);
      const eased = smoothstep(progress);
      recycled.x = this.clampCenter(
        this.segStartX + (this.segTargetX - this.segStartX) * eased,
      );
      this.points.unshift(recycled);
    }
  }

  /** Interpolated road center X at an arbitrary screen Y. */
  centerXAtY(y: number): number {
    const pts = this.points;
    if (pts.length < 4) return this.width / 2;
    if (y <= pts[0].y) return pts[0].x;
    const last = pts[pts.length - 1];
    if (y >= last.y) return last.x;

    let i = 1;
    while (i < pts.length - 1 && pts[i].y < y) i++;
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const t = clamp((y - p1.y) / (p2.y - p1.y), 0, 1);
    return catmullRom(p0.x, p1.x, p2.x, p3.x, t);
  }

  /** Road width is constant across the track. */
  roadWidthAtY(_y: number): number {
    return this.roadWidth;
  }
}
