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
/** Lateral half-width of drivable area beyond the asphalt edge (shoulder allowance). */
const SHOULDER_ALLOWANCE = 8;
/** Offset from road center at which the car counts as off-road (rumble + drag). */
const OFFROAD_THRESHOLD = 0.86;

export class Vehicle {
  /** Lateral offset in px from the road's center line. 0 = middle lane. */
  offset = 0;
  vx = 0;
  /** Current speed in km/h. */
  speed = 0;
  gear: GearTier = 'LOW';
  offRoad = false;

  reset(): void {
    this.offset = 0;
    this.vx = 0;
    this.speed = 0;
    this.gear = 'LOW';
    this.offRoad = false;
  }

  shiftGear(): void {
    this.gear = this.gear === 'LOW' ? 'HIGH' : 'LOW';
  }

  update(dt: number, input: VehicleInput, road: Road, width: number): void {
    const spec = GEARS[this.gear];
    const half = road.halfWidth(width);

    const wasOffRoad = this.offRoad;
    this.offRoad = Math.abs(this.offset) > half * OFFROAD_THRESHOLD;
    if (this.offRoad && !wasOffRoad) {
      // Instant velocity dampening when hitting the shoulder.
      this.vx *= 0.4;
    }
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
    this.offset += this.vx * dt;

    const limit = half + SHOULDER_ALLOWANCE;
    if (this.offset < -limit) {
      this.offset = -limit;
      this.vx = Math.min(this.vx, 0);
    } else if (this.offset > limit) {
      this.offset = limit;
      this.vx = Math.max(this.vx, 0);
    }
  }
}
