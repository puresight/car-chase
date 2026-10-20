import './style.css';
import { buildApexChaseTheme, applyTheme } from './theme';
import { initStorage } from './db';
import { initInstallPrompt, getState } from './install-prompt';
import { createHud, updateHud } from './hud';
import { createKeyboardInput, createTouchInput, type InputSource } from './game/input';
import { Engine, type EngineState } from './game/engine';
import { renderScene } from './game/renderer';

const tokens = buildApexChaseTheme();
applyTheme(tokens);

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="stage">
    <canvas id="game-canvas"></canvas>
    <div class="letterbox letterbox--left"></div>
    <div class="letterbox letterbox--right"></div>
    <div class="touch-deck" data-mode="hidden">
      <div class="touch-deck__steer" data-role="steer">
        <div class="touch-deck__steer-track"></div>
        <div class="touch-deck__steer-knob"></div>
      </div>
      <div class="touch-deck__actions">
        <button class="touch-deck__btn touch-deck__btn--brake" data-role="brake">BRAKE</button>
        <button class="touch-deck__btn touch-deck__btn--gear" data-role="gear">
          <span class="touch-deck__btn-label">GEAR</span>
          <span class="touch-deck__btn-value" data-bind="deck-gear">LOW</span>
        </button>
      </div>
    </div>
  </div>
`;

const hud = createHud();
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const touchDeck = app.querySelector<HTMLElement>('.touch-deck')!;
const steerPad = app.querySelector<HTMLElement>('[data-role="steer"]')!;
const gearBtn = app.querySelector<HTMLElement>('[data-role="gear"]')!;
const deckGearLabel = app.querySelector<HTMLElement>('[data-bind="deck-gear"]')!;

function resizeCanvas(): void {
  const rect = canvas.parentElement!.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let input: InputSource = createKeyboardInput();
let deckGear = 'LOW' as 'LOW' | 'HIGH';

const engine = new Engine(input);

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function syncViewport(): void {
  const rect = canvas.parentElement!.getBoundingClientRect();
  engine.setViewport(rect.width);
}
syncViewport();
window.addEventListener('resize', syncViewport);

function switchInput(next: InputSource): void {
  input.destroy();
  input = next;
  engine.swapInput(next);
  touchDeck.setAttribute('data-mode', next.usingTouch ? 'visible' : 'hidden');
}

gearBtn.addEventListener('gearshift', () => {
  deckGear = deckGear === 'LOW' ? 'HIGH' : 'LOW';
  engine.vehicle.gear = deckGear;
  deckGearLabel.textContent = deckGear;
});

const knob = steerPad.querySelector<HTMLElement>('.touch-deck__steer-knob')!;

function renderKnob(steer: number): void {
  const rect = steerPad.getBoundingClientRect();
  const range = rect.width / 2 - 26;
  knob.style.left = `${rect.width / 2 + steer * range}px`;
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ((key === 'shift' || key === ' ') && !e.repeat) {
    e.preventDefault();
    deckGear = deckGear === 'LOW' ? 'HIGH' : 'LOW';
    engine.vehicle.gear = deckGear;
    deckGearLabel.textContent = deckGear;
  }
});

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  switchInput(createTouchInput(steerPad, gearBtn));
}

engine.start((state: EngineState) => {
  const rect = canvas.parentElement!.getBoundingClientRect();
  renderScene(ctx, rect.width, rect.height, tokens, state.road, state.vehicle);
  updateHud(hud, {
    speed: state.vehicle.speed,
    gear: state.vehicle.gear,
    distance: state.distance,
    fps: state.fps,
  });
  if (input.usingTouch) {
    renderKnob(input.read().steer);
  }
});

initInstallPrompt();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[Apex Chase] service worker registration failed', err);
    });
  });
}

async function logInitSummary(): Promise<void> {
  const [storageEngine] = await Promise.all([initStorage()]);

  const tokensResolved = [
    '--surface-base',
    '--surface-road',
    '--accent-primary',
    '--accent-warning',
    '--accent-danger',
    '--neutral-secondary',
    '--ui-overlay',
  ].every((name) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value.length > 0;
  });

  const installState = getState();
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const swActive =
    'serviceWorker' in navigator && (await navigator.serviceWorker.getRegistration()) !== undefined;

  console.info(
    [
      '%c[Apex Chase] initialization summary',
      `  Storage engine:    ${storageEngine}`,
      `  Theme tokens:      ${tokensResolved ? 'resolved' : 'MISSING — check palette system'}`,
      `  PWA manifest:      ${document.querySelector('link[rel="manifest"]') ? 'linked' : 'MISSING'}`,
      `  Service worker:    ${swActive ? 'registered' : import.meta.env.PROD ? 'pending' : 'dev (skipped by design)'}`,
      `  Install prompt:    ${installState.isInstalled ? 'already installed' : installState.isAvailable ? 'available' : 'not offered by browser yet'}`,
      `  Display mode:      ${standalone ? 'standalone' : 'browser tab'}`,
      `  Input mode:        ${input.usingTouch ? 'touch overlay' : 'keyboard'}`,
    ].join('\n'),
    'color: #22d3ee; font-weight: bold;',
  );
}

void logInitSummary();
