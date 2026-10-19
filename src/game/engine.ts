import type { InputSource } from './input';
import { Road } from './road';
import { Vehicle } from './vehicle';

export interface EngineState {
  road: Road;
  vehicle: Vehicle;
  distance: number;
  fps: number;
}

export class Engine {
  readonly road = new Road();
  readonly vehicle = new Vehicle();
  distance = 0;
  fps = 60;

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

  start(draw: (state: EngineState, dt: number) => void): void {
    this.running = true;
    this.lastFrame = performance.now();
    const step = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;

      const input = this.input.read();
      this.vehicle.update(dt, input, this.road, this.viewportWidth);
      this.road.advance((this.vehicle.speed / 3.6) * dt);
      this.distance += (this.vehicle.speed / 3.6) * dt;

      this.frameTimes.push(now);
      while (this.frameTimes.length > 0 && now - this.frameTimes[0] > 1000) {
        this.frameTimes.shift();
      }
      this.fps = this.frameTimes.length;

      draw(
        { road: this.road, vehicle: this.vehicle, distance: this.distance, fps: this.fps },
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
