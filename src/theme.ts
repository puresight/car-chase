import chroma from 'chroma-js';

export interface ThemeTokens {
  /** Deep asphalt-black page / canvas background */
  surfaceBase: string;
  surfaceBaseGlow: string;
  /** Asphalt lane color + lane marking tint */
  surfaceRoad: string;
  surfaceRoadMark: string;
  /** Player pursuit vehicle + UI action highlights */
  accentPrimary: string;
  accentPrimaryGlow: string;
  /** Armory Hauler supply truck */
  accentWarning: string;
  /** Hostile AI (Enforcers, Razorbacks) */
  accentDanger: string;
  /** Neutral civilian traffic */
  neutralSecondary: string;
  /** HUD chrome, gear/readout text and panels */
  uiOverlay: string;
  uiOverlayMuted: string;
}

export interface Triad {
  primary: string;
  momentum: string;
  attention: string;
}

function clampChroma(hex: string, min: number): string {
  const [l, c, h] = chroma(hex).lch();
  return chroma.lch(l, Math.max(c, min), h).hex();
}

export function getActionTriad(seedHex: string): Triad {
  const base = chroma(seedHex);
  const lch = base.lch();
  const l = lch[0];
  const c = lch[1];
  const h = lch[2];
  return {
    primary: base.hex(),
    momentum: chroma.lch(l, Math.max(c, 50), (h + 120) % 360).hex(),
    attention: chroma.lch(l, Math.max(c, 50), (h + 240) % 360).hex(),
  };
}

export function getGlowStyle(hex: string, alpha = 0.25): string {
  return `0 0 20px -3px ${chroma(hex).alpha(alpha).css()}`;
}

export function getVibrantGradient(hexA: string, hexB: string, angle = '135deg'): string {
  return `linear-gradient(${angle}, ${hexA}, ${hexB})`;
}

/**
 * Apex Chase palette: seed chroma (cyan-pursuit) then derive a dark,
 * high-legibility token set. Triadic momentum = supply-truck amber,
 * triadic attention = hostile-enforcer red.
 */
export function buildApexChaseTheme(): ThemeTokens {
  const triad = getActionTriad('#22d3ee');
  const primary = clampChroma(triad.primary, 60);
  const warning = clampChroma(triad.momentum, 55);
  const danger = clampChroma(triad.attention, 55);

  return {
    surfaceBase: '#0a0e14',
    surfaceBaseGlow: chroma('#0a0e14').brighten(1.6).hex(),
    surfaceRoad: '#1b2028',
    surfaceRoadMark: chroma('#1b2028').brighten(4.5).hex(),
    accentPrimary: primary,
    accentPrimaryGlow: primary,
    accentWarning: warning,
    accentDanger: danger,
    neutralSecondary: (() => {
      const g = chroma('#8a939e');
      return chroma.lch(72, 8, g.lch()[2]).hex();
    })(),
    uiOverlay: '#e8edf2',
    uiOverlayMuted: chroma('#e8edf2').alpha(0.6).css(),
  };
}

export function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement.style;
  root.setProperty('--surface-base', tokens.surfaceBase);
  root.setProperty('--surface-base-glow', tokens.surfaceBaseGlow);
  root.setProperty('--surface-road', tokens.surfaceRoad);
  root.setProperty('--surface-road-mark', tokens.surfaceRoadMark);
  root.setProperty('--accent-primary', tokens.accentPrimary);
  root.setProperty('--accent-primary-glow', getGlowStyle(tokens.accentPrimary));
  root.setProperty('--accent-warning', tokens.accentWarning);
  root.setProperty('--accent-danger', tokens.accentDanger);
  root.setProperty('--neutral-secondary', tokens.neutralSecondary);
  root.setProperty('--ui-overlay', tokens.uiOverlay);
  root.setProperty('--ui-overlay-muted', tokens.uiOverlayMuted);
}
