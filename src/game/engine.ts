import type { InputSource } from './input';
import { Road } from './road';
import { Vehicle } from './vehicle';

export type Phase = 'IDLE' | 'PLAYING' | 'GAME_OVER';

export interface EngineState {
  road: Road;
  vehicle: Vehicle;
  distance: number;
  fps: number;
  phase: Phase;
}

/** km/h to px/s on screen. */
const SPEED_TO_PX = 2.6;
const ATTRACT_SPEED_PXS = 60;

export class Engine {
  readonly road = new Road();
  readonly vehicle = new Vehicle();
  distance = 0;
  fps = 60;
  phase: Phase = 'IDLE';

  private input: InputSource;
  private frameTimes: number[] = [];
  private rafId = 0;
  private lastFrame = 0;
  private running = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private scrollPx = 0;

  constructor(input: InputSource) {
    this.input = input;
  }

  swapInput(next: InputSource): void {
    this.input = next;
  }

  setViewport(width: number, height: number): void {
    const sizeChanged = width !== this.viewportWidth || height !== this.viewportHeight;
    this.viewportWidth = width;
    this.viewportHeight = height;
    if (sizeChanged) this.road.resize(width, height);
  }

  startMission(): void {
    this.vehicle.reset(this.viewportWidth);
    this.distance = 0;
    this.scrollPx = 0;
    this.phase = 'PLAYING';
  }

  gameOver(): void {
    this.phase = 'GAME_OVER';
  }

  toIdle(): void {
    this.vehicle.reset(this.viewportWidth);
    this.phase = 'IDLE';
  }

  start(draw: (state: EngineState, dt: number) => void): void {
    this.running = true;
    this.lastFrame = performance.now();
    const step = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;

      if (this.phase === 'PLAYING') {
        const input = this.input.read();
        this.vehicle.update(
          dt,
          input,
          this.road,
          this.viewportWidth,
          this.viewportHeight,
        );
        const meters = (this.vehicle.speed / 3.6) * dt;
        this.distance += meters;
        this.scrollPx += (this.vehicle.speed / 3.6) * SPEED_TO_PX * dt;
        this.road.advance(dt, (this.vehicle.speed / 3.6) * SPEED_TO_PX);
      } else if (this.phase === 'IDLE') {
        // Attract mode: slow ambient scroll, car parked center.
        this.road.advance(dt, ATTRACT_SPEED_PXS);
        this.scrollPx += ATTRACT_SPEED_PXS * dt;
        this.vehicle.reset(this.viewportWidth);
      }

      this.frameTimes.push(now);
      while (this.frameTimes.length > 0 && now - this.frameTimes[0] > 1000) {
        this.frameTimes.shift();
      }
      this.fps = this.frameTimes.length;

      draw(
        {
          road: this.road,
          vehicle: this.vehicle,
          distance: this.distance,
          fps: this.fps,
          phase: this.phase,
        },
        dt,
      );
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get pixelScroll(): number {
    return this.scrollPx;
  }
}
