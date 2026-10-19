import type { VehicleInput } from './vehicle';

export interface InputSource {
  read(): VehicleInput;
  usingTouch: boolean;
  destroy(): void;
}

const KEY_STEER = 380;
const KEY_STEER_RETURN = 520;

export function createKeyboardInput(): InputSource {
  const held = new Set<string>();
  let steer = 0;

  const onKeyDown = (e: KeyboardEvent): void => {
    held.add(e.key.toLowerCase());
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.key.toLowerCase());
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    usingTouch: false,
    read(): VehicleInput {
      const left = held.has('arrowleft') || held.has('a');
      const right = held.has('arrowright') || held.has('d');
      if (left && !right) steer -= KEY_STEER;
      else if (right && !left) steer += KEY_STEER;
      else steer -= Math.sign(steer) * Math.min(Math.abs(steer), KEY_STEER_RETURN);
      return {
        steer: Math.max(-1, Math.min(1, steer / 400)),
        throttle: held.has('arrowup') || held.has('w'),
        brake: held.has('arrowdown') || held.has('s'),
      };
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}

export function createTouchInput(root: HTMLElement, gearBtn: HTMLElement): InputSource {
  let steerAnalog = 0;
  let pointerId: number | null = null;
  let brake = false;

  const setFromEvent = (e: PointerEvent): void => {
    const rect = root.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    steerAnalog = Math.max(-1, Math.min(1, rel * 1.4));
  };

  const onDown = (e: PointerEvent): void => {
    pointerId = e.pointerId;
    root.setPointerCapture(e.pointerId);
    setFromEvent(e);
    root.classList.add('is-active');
  };
  const onMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    setFromEvent(e);
  };
  const onUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    steerAnalog = 0;
    root.classList.remove('is-active');
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  const onGear = (e: Event): void => {
    e.preventDefault();
    gearBtn.dispatchEvent(new CustomEvent('gearshift', { bubbles: true }));
  };
  gearBtn.addEventListener('pointerdown', onGear);

  const brakeOn = (e: PointerEvent): void => {
    e.preventDefault();
    brake = true;
  };
  const brakeOff = (): void => {
    brake = false;
  };
  const brakeBtn = root.querySelector<HTMLElement>('[data-role="brake"]')!;
  brakeBtn.addEventListener('pointerdown', brakeOn);
  brakeBtn.addEventListener('pointerup', brakeOff);
  brakeBtn.addEventListener('pointercancel', brakeOff);
  brakeBtn.addEventListener('pointerleave', brakeOff);

  return {
    usingTouch: true,
    read(): VehicleInput {
      return { steer: steerAnalog, throttle: true, brake };
    },
    destroy() {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      gearBtn.removeEventListener('pointerdown', onGear);
      brakeBtn.removeEventListener('pointerdown', brakeOn);
      brakeBtn.removeEventListener('pointerup', brakeOff);
      brakeBtn.removeEventListener('pointercancel', brakeOff);
      brakeBtn.removeEventListener('pointerleave', brakeOff);
    },
  };
}
