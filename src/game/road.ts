export const PLAYER_AHEAD_METERS = 6;

interface Segment {
  /** Absolute world position where this segment begins (meters). */
  startWorld: number;
  /** Segment length in meters. */
  length: number;
  /** Curvature target: 0 = straight, otherwise -0.6..+0.6 (left/right sweep). */
  curvature: number;
}

const CURVE_GAIN = 0.22;
const SHOULDER_PX = 14;
const EDGE_MARGIN = 8;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Segment-based road engine. The world is a queue of straightaways
 * (300-600m, curvature 0) and sweeping bends (200-400m, curvature
 * -0.6..+0.6). The center line at any world distance is the accumulated
 * displacement of every segment up to that point, eased with smoothstep so
 * bends enter and exit gently. Displacement is clamped so lanes never clip
 * off-screen.
 */
export class Road {
  /** Total world distance scrolled, in meters. */
  scroll = 0;
  lanes = 3;
  widthFraction = 0.55;

  private segments: Segment[] = [];
  private plannedUpTo = 0;
  private baseOffset = 0;

  constructor() {
    this.planMore();
  }

  private planMore(): void {
    while (this.plannedUpTo < this.scroll + 2000) {
      const straight = Math.random() < 0.75;
      let seg: Segment;
      if (straight) {
        seg = { startWorld: this.plannedUpTo, length: 300 + Math.random() * 300, curvature: 0 };
      } else {
        const magnitude = 0.25 + Math.random() * 0.35;
        // Bias bends to counteract accumulated drift so the road stays centered.
        const drift = this.accumulatedOffset();
        const sign = Math.abs(drift) > 30 ? -Math.sign(drift) : Math.random() < 0.5 ? -1 : 1;
        seg = {
          startWorld: this.plannedUpTo,
          length: 200 + Math.random() * 200,
          curvature: sign * magnitude,
        };
      }
      this.segments.push(seg);
      this.plannedUpTo += seg.length;
    }
  }

  private segmentShift(seg: Segment): number {
    return seg.curvature * CURVE_GAIN * seg.length;
  }

  private accumulatedOffset(): number {
    let o = this.baseOffset;
    for (const seg of this.segments) o += this.segmentShift(seg);
    return o;
  }

  /** Lateral road-center offset (px from canvas center) at world distance s. */
  private offsetAt(s: number, width: number): number {
    this.planMore();
    const half = this.halfWidth(width);
    const maxDrift = Math.max(10, width / 2 - half - SHOULDER_PX - EDGE_MARGIN);

    let offset = this.baseOffset;
    for (const seg of this.segments) {
      const end = seg.startWorld + seg.length;
      if (s < end) {
        const t = clamp((s - seg.startWorld) / seg.length, 0, 1);
        const eased = t * t * (3 - 2 * t);
        return clamp(offset + this.segmentShift(seg) * eased, -maxDrift, maxDrift);
      }
      offset += this.segmentShift(seg);
    }
    return clamp(offset, -maxDrift, maxDrift);
  }

  advance(meters: number): void {
    this.scroll += meters;
    while (
      this.segments.length > 0 &&
      this.scroll >= this.segments[0].startWorld + this.segments[0].length
    ) {
      const seg = this.segments.shift()!;
      this.baseOffset += this.segmentShift(seg);
    }
    this.planMore();
  }

  /** Road center X at an arbitrary world distance s (meters from start). */
  centerXAt(s: number, width: number): number {
    return width / 2 + this.offsetAt(s, width);
  }

  /** Road center X under the player's car (at the car's screen row). */
  centerX(width: number): number {
    return this.centerXAt(this.scroll + PLAYER_AHEAD_METERS, width);
  }

  halfWidth(width: number): number {
    return (width * this.widthFraction) / 2;
  }

  isOffRoad(x: number, width: number): boolean {
    const center = this.centerXAt(this.scroll + PLAYER_AHEAD_METERS, width);
    return Math.abs(x - center) > this.halfWidth(width) - 14;
  }
}
