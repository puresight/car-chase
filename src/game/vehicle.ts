import type { GearTier } from '../db';
import type { Road } from './road';

export interface VehicleInput {
  steer: number;
  throttle: boolean;
  brake: boolean;
}

interface GearSpec {
  maxSpeed: number;
  accel: number;
  coastDrag: number;
  steerMax: number;
  grip: number;
}

const GEARS: Record<GearTier, GearSpec> = {
  LOW: { maxSpeed: 200, accel: 150, coastDrag: 60, steerMax: 340, grip: 9 },
  HIGH: { maxSpeed: 400, accel: 70, coastDrag: 28, steerMax: 250, grip: 3.5 },
};

const BRAKE_DECEL = 280;
const OFFROAD_EXTRA_DRAG = 130;
const OFFROAD_SPEED_FACTOR = 0.45;

export class Vehicle {
  x = 0;
  vx = 0;
  /** Current speed in km/h. */
  speed = 0;
  gear: GearTier = 'LOW';
  offRoad = false;

  shiftGear(): void {
    this.gear = this.gear === 'LOW' ? 'HIGH' : 'LOW';
  }

  update(dt: number, input: VehicleInput, road: Road, width: number): void {
    const spec = GEARS[this.gear];

    this.offRoad = road.isOffRoad(this.x, width);
    const maxNow = spec.maxSpeed * (this.offRoad ? OFFROAD_SPEED_FACTOR : 1);

    if (input.throttle && !input.brake) {
      const headroom = Math.max(0.12, 1 - this.speed / maxNow);
      this.speed += spec.accel * headroom * dt;
    } else {
      this.speed -= spec.coastDrag * dt;
    }
    if (input.brake) this.speed -= BRAKE_DECEL * dt;
    if (this.offRoad && this.speed > maxNow) this.speed -= OFFROAD_EXTRA_DRAG * dt;
    this.speed = Math.max(0, Math.min(this.speed, spec.maxSpeed));

    const speedFactor = Math.min(this.speed / spec.maxSpeed, 1);
    const authority = spec.steerMax * (0.45 + 0.55 * speedFactor);
    const targetVx = input.steer * authority;
    const k = 1 - Math.exp(-spec.grip * dt);
    this.vx += (targetVx - this.vx) * k;
    this.x += this.vx * dt;

    const margin = 18;
    if (this.x < margin) {
      this.x = margin;
      this.vx = 0;
    } else if (this.x > width - margin) {
      this.x = width - margin;
      this.vx = 0;
    }
  }
}
