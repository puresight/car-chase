export class Road {
  /** Total world distance scrolled, in meters. */
  scroll = 0;
  lanes = 3;
  widthFraction = 0.55;

  advance(meters: number): void {
    this.scroll += meters;
  }

  centerX(width: number): number {
    const s = this.scroll;
    const amp = width * 0.16;
    return (
      width / 2 +
      amp * (0.5 * Math.sin(s * 0.01) + 0.32 * Math.sin(s * 0.023 + 1.7) + 0.18 * Math.sin(s * 0.041 + 0.6))
    );
  }

  halfWidth(width: number): number {
    return (width * this.widthFraction) / 2;
  }

  isOffRoad(x: number, width: number): boolean {
    return Math.abs(x - this.centerX(width)) > this.halfWidth(width) - 14;
  }
}
