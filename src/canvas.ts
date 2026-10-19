import type { ThemeTokens } from './theme';

export interface HudHandles {
  speed: HTMLElement;
  gear: HTMLElement;
  distance: HTMLElement;
  score: HTMLElement;
}

export function createHud(): HudHandles {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="hud__stat" data-stat="speed">
      <span class="hud__label">Speed</span>
      <span class="hud__value" data-bind="speed">0</span>
      <span class="hud__unit">km/h</span>
    </div>
    <div class="hud__stat" data-stat="gear">
      <span class="hud__label">Gear</span>
      <span class="hud__value" data-bind="gear">LOW</span>
    </div>
    <div class="hud__stat" data-stat="distance">
      <span class="hud__label">Distance</span>
      <span class="hud__value" data-bind="distance">0</span>
      <span class="hud__unit">m</span>
    </div>
    <div class="hud__stat" data-stat="score">
      <span class="hud__label">Score</span>
      <span class="hud__value" data-bind="score">0</span>
    </div>
  `;
  document.body.appendChild(root);

  const pick = (name: string) => root.querySelector<HTMLElement>(`[data-bind="${name}"]`)!;
  return {
    speed: pick('speed'),
    gear: pick('gear'),
    distance: pick('distance'),
    score: pick('score'),
  };
}

export function renderSmokeTest(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tokens: ThemeTokens,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = tokens.surfaceBase;
  ctx.fillRect(0, 0, width, height);

  const roadWidth = width * 0.55;
  const roadLeft = (width - roadWidth) / 2;
  ctx.fillStyle = tokens.surfaceRoad;
  ctx.fillRect(roadLeft, 0, roadWidth, height);

  ctx.fillStyle = tokens.surfaceRoadMark;
  const dashH = height / 24;
  const gap = dashH * 1.6;
  const laneX = width / 2 - 2;
  const laneW = 4;
  const offset = (performance.now() / 12) % (dashH + gap);
  for (let y = -dashH - gap + offset; y < height; y += dashH + gap) {
    ctx.fillRect(laneX, y, laneW, dashH);
  }
  ctx.fillStyle = tokens.surfaceRoadMark;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(roadLeft + 6, 0, 2, height);
  ctx.fillRect(roadLeft + roadWidth - 8, 0, 2, height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = tokens.accentPrimary;
  ctx.fillRect(width / 2 - 14, height * 0.78, 28, 44);
  ctx.fillStyle = tokens.accentWarning;
  ctx.fillRect(width / 2 - 60, height * 0.4, 24, 36);
  ctx.fillStyle = tokens.accentDanger;
  ctx.fillRect(width / 2 + 40, height * 0.55, 24, 36);
  ctx.fillStyle = tokens.neutralSecondary;
  ctx.fillRect(width / 2 - 36, height * 0.22, 22, 34);
}
