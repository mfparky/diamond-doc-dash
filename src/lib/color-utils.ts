/** Shared color math for team brand-color customization. */

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHex(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * WCAG relative luminance (0 = black, 1 = white).
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Picks black or white text for readable contrast against a given
 * background color, per WCAG relative luminance — used to auto-derive
 * accentText whenever a coach picks/uploads a custom brand color, since we
 * can't know in advance whether their color needs light or dark text on it.
 */
export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  if (!isValidHexColor(hex)) return '#000000';
  const [r, g, b] = hexToRgb(hex);
  return relativeLuminance(r, g, b) > 0.45 ? '#000000' : '#ffffff';
}
