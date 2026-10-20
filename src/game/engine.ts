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

const ATTRACT_SCROLL_MPS = 20;

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

  constructor(input: InputSource) {
    this.input = input;
  }

  swapInput(next: InputSource): void {
    this.input = next;
  }

  setViewport(width: number): void {
    this.viewportWidth = width;
  }

  startMission(): void {
    this.vehicle.reset();
    this.distance = 0;
    this.phase = 'PLAYING';
  }

  gameOver(): void {
    this.phase = 'GAME_OVER';
  }

  toIdle(): void {
    this.vehicle.reset();
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
        this.vehicle.update(dt, input, this.road, this.viewportWidth);
        const meters = (this.vehicle.speed / 3.6) * dt;
        this.road.advance(meters);
        this.distance += meters;
      } else if (this.phase === 'IDLE') {
        // Attract mode: slow ambient scroll, car parked center.
        this.road.advance(ATTRACT_SCROLL_MPS * dt);
        this.vehicle.offset = 0;
        this.vehicle.vx = 0;
        this.vehicle.speed = 0;
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
}
