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

const GEARS: Record<'LOW' | 'HIGH', GearSpec> = {
  LOW: { maxSpeed: 200, accel: 150, coastDrag: 60, steerMax: 340, grip: 9 },
  HIGH: { maxSpeed: 400, accel: 70, coastDrag: 28, steerMax: 250, grip: 3.5 },
};

const BRAKE_DECEL = 280;
const OFFROAD_EXTRA_DRAG = 130;
/** Shoulder/grass cuts top speed by 50%. */
const OFFROAD_SPEED_FACTOR = 0.5;
const PLAYER_WIDTH = 30;
const EDGE_MARGIN = 16;

export class Vehicle {
  /** Absolute screen X of the car's center, in px. */
  x = 200;
  vx = 0;
  /** Current speed in km/h. */
  speed = 0;
  gear: 'LOW' | 'HIGH' = 'LOW';
  offRoad = false;

  reset(width: number): void {
    this.x = width / 2;
    this.vx = 0;
    this.speed = 0;
    this.gear = 'LOW';
    this.offRoad = false;
  }

  shiftGear(): void {
    this.gear = this.gear === 'LOW' ? 'HIGH' : 'LOW';
  }

  update(dt: number, input: VehicleInput, road: Road, width: number, height: number): void {
    const spec = GEARS[this.gear];
    const playerY = height * 0.75;
    const centerX = road.centerXAtY(playerY);
    const half = road.roadWidthAtY(playerY) / 2;

    const wasOffRoad = this.offRoad;
    this.offRoad = Math.abs(this.x - centerX) > half - PLAYER_WIDTH / 2;
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
    this.x += this.vx * dt;

    if (this.x < EDGE_MARGIN) {
      this.x = EDGE_MARGIN;
      this.vx = Math.min(this.vx, 0);
    } else if (this.x > width - EDGE_MARGIN) {
      this.x = width - EDGE_MARGIN;
      this.vx = Math.max(this.vx, 0);
    }
  }
}
