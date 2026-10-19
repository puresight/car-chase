import './style.css';
import { buildApexChaseTheme, applyTheme } from './theme';
import { createHud, renderSmokeTest } from './canvas';
import { db } from './db';

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

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __apexChaseInstallPrompt?: Event }).__apexChaseInstallPrompt = e;
});

db.on('ready', () => {
  console.debug('[ApexChaseDB] local-first store ready');
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[Apex Chase] service worker registration failed', err);
    });
  });
}
