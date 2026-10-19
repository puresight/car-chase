import './style.css';
import { buildApexChaseTheme, applyTheme } from './theme';
import { createHud, renderSmokeTest } from './canvas';
import { initStorage } from './db';
import { initInstallPrompt, getState } from './install-prompt';

const tokens = buildApexChaseTheme();
applyTheme(tokens);

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="stage">
    <canvas id="game-canvas"></canvas>
    <div class="letterbox letterbox--left"></div>
    <div class="letterbox letterbox--right"></div>
  </div>
`;

const hud = createHud();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resizeCanvas(): void {
  const rect = canvas.parentElement!.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let speed = 0;
let gear: 'LOW' | 'HIGH' = 'LOW';
let distance = 0;
let score = 0;
let lastFrame = performance.now();

function loop(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  speed = 120 + Math.sin(now / 900) * 40;
  gear = speed > 130 ? 'HIGH' : 'LOW';
  distance += (speed / 3.6) * dt;
  score += speed * dt * 0.1;

  hud.speed.textContent = Math.round(speed).toString();
  hud.gear.textContent = gear;
  hud.distance.textContent = Math.round(distance).toString();
  hud.score.textContent = Math.round(score).toString();

  const rect = canvas.parentElement!.getBoundingClientRect();
  renderSmokeTest(ctx, rect.width, rect.height, tokens);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

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
    'serviceWorker' in navigator &&
    (await navigator.serviceWorker.getRegistration()) !== undefined;

  console.info(
    [
      '%c[Apex Chase] initialization summary',
      `  Storage engine:    ${storageEngine}`,
      `  Theme tokens:      ${tokensResolved ? 'resolved' : 'MISSING — check palette system'}`,
      `  PWA manifest:      ${document.querySelector('link[rel="manifest"]') ? 'linked' : 'MISSING'}`,
      `  Service worker:    ${swActive ? 'registered' : import.meta.env.PROD ? 'pending' : 'dev (skipped by design)'}`,
      `  Install prompt:    ${installState.isInstalled ? 'already installed' : installState.isAvailable ? 'available' : 'not offered by browser yet'}`,
      `  Display mode:      ${standalone ? 'standalone' : 'browser tab'}`,
    ].join('\n'),
    'color: #22d3ee; font-weight: bold;',
  );
}

void logInitSummary();
