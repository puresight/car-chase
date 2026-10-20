interface Segment {
  /** Meters covered by this segment. */
  length: number;
  /** Lateral shift (px at reference width) from segment start to segment end. */
  shift: number;
  /** Entry lateral offset, resolved when the segment becomes active. */
  startOffset: number;
}

/**
 * Segment-based road model: long straights (75%) interleaved with gentle,
 * pre-planned curves (25%). The center line is a smooth, bounded polyline
 * over world distance — no per-frame oscillation.
 */
export class Road {
  /** Total world distance scrolled, in meters. */
  scroll = 0;
  lanes = 3;
  widthFraction = 0.55;

  private segments: Segment[] = [];
  private plannedUpTo = 0;

  constructor() {
    this.planMore();
  }

  private planMore(): void {
    // Plan until we have 2000m of lookahead beyond current scroll.
    while (this.plannedUpTo < this.scroll + 2000) {
      const straight = Math.random() > 0.25;
      const length = straight
        ? 320 + Math.random() * 480 // 320–800m straight
        : 220 + Math.random() * 280; // 220–500m curve
      const shift = straight
        ? 0
        : (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 90); // 60–150px drift
      this.segments.push({ length, shift, startOffset: 0 });
      this.plannedUpTo += length;
    }
  }

  /** Lateral offset (px) of the road center from the canvas center at world distance s. */
  private offsetAt(s: number): number {
    this.resolveStartOffsets();
    this.planMore();

    let remaining = s;
    let offset = 0;
    for (const seg of this.segments) {
      if (remaining <= seg.length) {
        const t = Math.max(0, remaining / seg.length);
        // Smoothstep for gentle enter/exit transitions (large effective radius).
        const eased = t * t * (3 - 2 * t);
        return offset + seg.shift * eased;
      }
      remaining -= seg.length;
      offset += seg.shift;
    }
    return offset;
  }

  /** Bake absolute start offsets once a segment becomes reachable. */
  private resolveStartOffsets(): void {
    let acc = 0;
    for (const seg of this.segments) {
      seg.startOffset = acc;
      acc += seg.shift;
    }
  }

  /** Drop fully-consumed segments so the list doesn't grow unbounded. */
  private prune(): void {
    let consumed = 0;
    let i = 0;
    while (i < this.segments.length) {
      const seg = this.segments[i];
      if (this.scroll >= seg.startOffset + seg.length) {
        consumed += seg.length;
        i++;
      } else {
        break;
      }
    }
    if (consumed > 0) {
      this.segments.splice(0, i);
      // Re-anchor remaining segments relative to the new baseline.
      let acc = 0;
      for (const seg of this.segments) {
        seg.startOffset = acc;
        acc += seg.shift;
      }
    }
  }

  advance(meters: number): void {
    this.scroll += meters;
    this.prune();
  }

  centerX(width: number): number {
    return width / 2 + this.offsetAt(this.scroll);
  }

  /** Road center X at an arbitrary world distance s (meters scrolled from start). */
  centerXAt(s: number, width: number): number {
    return width / 2 + this.offsetAt(s);
  }

  /** Total world distance scrolled, in meters. */
  get scrollAbs(): number {
    return this.scroll;
  }

  halfWidth(width: number): number {
    return (width * this.widthFraction) / 2;
  }

  isOffRoad(x: number, width: number): boolean {
    return Math.abs(x - this.centerX(width)) > this.halfWidth(width) - 14;
  }
}
