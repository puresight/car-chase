export interface RoadNode {
  y: number;
  centerX: number;
  roadWidth: number;
}

const NODE_SPACING = 30;
/** Road edges must stay at least this far inside the canvas boundary. */
const EDGE_INSET = 20;
/** Fraction-of-width curve targets: gentle left, center, gentle right. */
const CURVE_TARGETS = [0.35, 0.5, 0.65];
/** How strongly each new node eases toward the current curve target. */
const CURVE_LERP = 0.14;

/**
 * Waypoint-based spline track. Nodes span from y = -100 to height + 100,
 * spaced 30px apart. Nodes scroll downward with player speed; when one
 * exits the bottom it recycles to the top with its centerX eased toward a
 * curve target that changes every 5-8 seconds.
 */
export class Road {
  nodes: RoadNode[] = [];
  width = 0;
  height = 0;
  roadWidth = 0;

  private targetCurveX = 0;
  private targetTimer = 0;
  private nextTargetIn = 6;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.roadWidth = width * 0.65;
    const count = Math.ceil((height + 200) / NODE_SPACING) + 1;
    const mid = this.clampCenter(width / 2);
    this.nodes = [];
    for (let i = 0; i <= count; i++) {
      this.nodes.push({ y: -100 + i * NODE_SPACING, centerX: mid, roadWidth: this.roadWidth });
    }
    this.targetCurveX = mid;
    this.targetTimer = 0;
  }

  private clampCenter(cx: number): number {
    const min = this.roadWidth / 2 + EDGE_INSET;
    const max = this.width - this.roadWidth / 2 - EDGE_INSET;
    return Math.max(min, Math.min(max, cx));
  }

  advance(dt: number, pxSpeed: number): void {
    const dy = pxSpeed * dt;
    for (const node of this.nodes) node.y += dy;

    this.targetTimer += dt;
    if (this.targetTimer >= this.nextTargetIn) {
      this.targetTimer = 0;
      this.nextTargetIn = 5 + Math.random() * 3;
      this.pickTarget();
    }

    while (this.nodes[this.nodes.length - 1].y > this.height + 100) {
      const recycled = this.nodes.pop()!;
      recycled.y = this.nodes[0].y - NODE_SPACING;
      recycled.centerX = this.clampCenter(
        recycled.centerX + (this.targetCurveX - recycled.centerX) * CURVE_LERP,
      );
      recycled.roadWidth = this.roadWidth;
      this.nodes.unshift(recycled);
    }
  }

  private pickTarget(): void {
    const currentFrac = this.targetCurveX / this.width;
    const options = CURVE_TARGETS.filter((f) => Math.abs(f - currentFrac) > 0.01);
    const pick = options[Math.floor(Math.random() * options.length)];
    this.targetCurveX = this.clampCenter(pick * this.width);
  }

  /** Interpolated road center X at an arbitrary screen Y. */
  centerXAtY(y: number): number {
    return this.sample(y).centerX;
  }

  /** Interpolated road width at an arbitrary screen Y. */
  roadWidthAtY(y: number): number {
    return this.sample(y).roadWidth;
  }

  private sample(y: number): RoadNode {
    const nodes = this.nodes;
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
}
