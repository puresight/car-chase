type SegKind = 'straight' | 'left' | 'right' | 'center';

interface Segment {
  startWorld: number;
  lengthPx: number;
  startX: number;
  targetX: number;
  kind: SegKind;
}

/** Road edges stay at least this far inside the canvas boundary. */
const EDGE_INSET = 20;
/** Narrow 3-lane profile. */
const ROAD_WIDTH_FRACTION = 0.48;
/** Hard curve destinations, as fractions of canvas width. */
const LEFT_FRACTION = 0.22;
const CENTER_FRACTION = 0.5;
const RIGHT_FRACTION = 0.78;
/** The car sits this far down the screen; used to map screen Y to world distance. */
const PLAYER_ROW = 0.75;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Smootherstep: zero first and second derivatives at both ends (no sudden slope/kinks). */
function smootherstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Double smoothstep: same zero-derivative ends but a steeper mid-arc for a harder tangent ramp. */
function easeInOutSharp(t: number): number {
  return smootherstep(smootherstep(t));
}

/**
 * Analytic highway spline. The road center is a single long ease between a
 * segment's start and target X, evaluated as a smooth curve over the segment's
 * vertical travel distance. Segments span 1200-2500px, so a 700px viewport
 * shows at most one broad arc or one steady straightaway at a time.
 */
export class Road {
  width = 0;
  height = 0;
  roadWidth = 0;

  /** Total vertical travel (px) — world distance at the player's row. */
  private travel = 0;
  private segments: Segment[] = [];
  private plannedUpTo = 0;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.roadWidth = width * ROAD_WIDTH_FRACTION;
    this.travel = 0;
    this.segments = [];
    const center = this.clampCenter(width / 2);
    // Begin one baseline straight covering the negative world behind the car.
    this.plannedUpTo = -height;
    this.pushSegment('straight', center);
  }

  private clampCenter(x: number): number {
    const half = this.roadWidth / 2;
    return clamp(x, half + EDGE_INSET, this.width - half - EDGE_INSET);
  }

  private pushSegment(kind: SegKind, startX: number): void {
    const lengthPx = kind === 'straight' ? rand(1500, 2500) : rand(1200, 1800);
    let targetX = startX;
    if (kind === 'left') targetX = this.clampCenter(this.width * LEFT_FRACTION);
    else if (kind === 'right') targetX = this.clampCenter(this.width * RIGHT_FRACTION);
    else if (kind === 'center') targetX = this.clampCenter(this.width * CENTER_FRACTION);
    this.segments.push({ startWorld: this.plannedUpTo, lengthPx, startX, targetX, kind });
    this.plannedUpTo += lengthPx;
  }

  private pickKind(currentX: number): SegKind {
    const center = this.width / 2;
    const drift = (currentX - center) / (this.width / 4);
    let pLeft = 0.17;
    let pRight = 0.17;
    let pCenter = 0.11;
    if (drift > 0.15) {
      pLeft = 0.4;
      pRight = 0.03;
      pCenter = 0.15;
    } else if (drift < -0.15) {
      pRight = 0.4;
      pLeft = 0.03;
      pCenter = 0.15;
    }
    const r = Math.random();
    if (r < pLeft) return 'left';
    if (r < pLeft + pRight) return 'right';
    if (r < pLeft + pRight + pCenter) return 'center';
    return 'straight';
  }

  private ensurePlanned(upToWorld: number): void {
    while (this.plannedUpTo < upToWorld) {
      const last = this.segments[this.segments.length - 1];
      this.pushSegment(this.pickKind(last.targetX), last.targetX);
    }
  }

  private centerXAtWorld(world: number): number {
    this.ensurePlanned(world);
    const segs = this.segments;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const end = s.startWorld + s.lengthPx;
      if (world < end) {
        if (world < s.startWorld) return s.startX;
        const t = (world - s.startWorld) / s.lengthPx;
        return s.startX + (s.targetX - s.startX) * easeInOutSharp(t);
      }
    }
    const last = segs[segs.length - 1];
    return last.targetX;
  }

  advance(dt: number, pxSpeed: number): void {
    const dy = pxSpeed * dt;
    if (dy <= 0) return;
    this.travel += dy;
    this.ensurePlanned(this.travel + this.height * 2);

    // Prune segments fully behind the visible area.
    const behind = this.travel - this.height;
    let i = 0;
    while (
      i < this.segments.length - 1 &&
      this.segments[i].startWorld + this.segments[i].lengthPx < behind
    ) {
      i++;
    }
    if (i > 0) this.segments.splice(0, i);
  }

  /** Interpolated road center X at an arbitrary screen Y. */
  centerXAtY(y: number): number {
    const world = this.travel + (PLAYER_ROW * this.height - y);
    return this.centerXAtWorld(world);
  }

  /** Road width is constant across the track. */
  roadWidthAtY(_y: number): number {
    return this.roadWidth;
  }
}
