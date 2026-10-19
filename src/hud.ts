export interface HudHandles {
  speed: HTMLElement;
  gear: HTMLElement;
  gearChip: HTMLElement;
  distance: HTMLElement;
  fps: HTMLElement;
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
    <div class="hud__stat hud__stat--gear" data-gear="LOW">
      <span class="hud__label">Gear</span>
      <span class="hud__value" data-bind="gear">LOW</span>
    </div>
    <div class="hud__stat" data-stat="distance">
      <span class="hud__label">Distance</span>
      <span class="hud__value" data-bind="distance">0</span>
      <span class="hud__unit">m</span>
    </div>
    <div class="hud__stat hud__stat--fps" data-stat="fps">
      <span class="hud__label">FPS</span>
      <span class="hud__value" data-bind="fps">60</span>
    </div>
  `;
  document.body.appendChild(root);

  const pick = (name: string) => root.querySelector<HTMLElement>(`[data-bind="${name}"]`)!;
  return {
    speed: pick('speed'),
    gear: pick('gear'),
    gearChip: root.querySelector<HTMLElement>('.hud__stat--gear')!,
    distance: pick('distance'),
    fps: pick('fps'),
  };
}

export interface HudMetrics {
  speed: number;
  gear: 'LOW' | 'HIGH';
  distance: number;
  fps: number;
}

const lastText = new Map<HTMLElement, string>();

function setText(el: HTMLElement, text: string): void {
  if (lastText.get(el) === text) return;
  lastText.set(el, text);
  el.textContent = text;
}

export function updateHud(hud: HudHandles, m: HudMetrics): void {
  setText(hud.speed, String(Math.round(m.speed)));
  setText(hud.gear, m.gear);
  setText(hud.distance, String(Math.round(m.distance)));
  setText(hud.fps, String(Math.round(m.fps)));
  if (hud.gearChip.getAttribute('data-gear') !== m.gear) {
    hud.gearChip.setAttribute('data-gear', m.gear);
  }
}
