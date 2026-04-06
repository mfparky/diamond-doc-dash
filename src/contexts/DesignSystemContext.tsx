import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type HSL = {
  h: number;
  s: number;
  l: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToHSLObject(hex: string): HSL {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToString({ h, s, l }: HSL): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hexToHSL(hex: string): string {
  return hslToString(hexToHSLObject(hex));
}

function toneFrom(base: HSL, overrides: Partial<HSL>): string {
  return hslToString({
    h: overrides.h ?? base.h,
    s: clamp(overrides.s ?? base.s, 0, 100),
    l: clamp(overrides.l ?? base.l, 0, 100),
  });
}

export interface DesignSystemTheme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentText: string;
  statusGreen: string;
  statusYellow: string;
  statusRed: string;
  borderSolid: string;
  radius: string;
  font: string;
  displayFont?: string;
  isDark: boolean;
}

export const DESIGN_SYSTEMS: DesignSystemTheme[] = [
  {
    id: 'default',
    name: 'Arm Stats (Default)',
    bg: '#0f1517', surface: '#1b2022', surfaceElevated: '#242c2f',
    textPrimary: '#f4f4ef', textSecondary: '#b8c2c5', textMuted: '#7f9295',
    accent: '#4abe7a', accentBg: '#2d8c4e', accentText: '#f4f4ef',
    statusGreen: '#4abe7a', statusYellow: '#f59e0a', statusRed: '#ef4444',
    borderSolid: '#2d3436', radius: '0.75rem',
    font: "'Inter', system-ui, sans-serif", displayFont: "'Space Grotesk', sans-serif",
    isDark: true,
  },
  {
    id: 'linear',
    name: 'Linear',
    bg: '#08090a', surface: '#191a1b', surfaceElevated: '#28282c',
    textPrimary: '#f7f8f8', textSecondary: '#d0d6e0', textMuted: '#8a8f98',
    accent: '#5e6ad2', accentBg: '#5e6ad2', accentText: '#ffffff',
    statusGreen: '#27a644', statusYellow: '#f59e0b', statusRed: '#ef4444',
    borderSolid: '#23252a', radius: '0.375rem',
    font: "'Inter', -apple-system, system-ui, sans-serif",
    isDark: true,
  },
  {
    id: 'apple',
    name: 'Apple',
    bg: '#f5f5f7', surface: '#ffffff', surfaceElevated: '#fafafc',
    textPrimary: '#1d1d1f', textSecondary: '#6e6e73', textMuted: '#86868b',
    accent: '#0071e3', accentBg: '#0071e3', accentText: '#ffffff',
    statusGreen: '#1a7f37', statusYellow: '#9e5a00', statusRed: '#c0392b',
    borderSolid: '#d2d2d7', radius: '0.75rem',
    font: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    isDark: false,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    bg: '#f6f9fc', surface: '#ffffff', surfaceElevated: '#f0f4f9',
    textPrimary: '#061b31', textSecondary: '#273951', textMuted: '#64748d',
    accent: '#533afd', accentBg: '#533afd', accentText: '#ffffff',
    statusGreen: '#108c3d', statusYellow: '#9b6829', statusRed: '#c0145c',
    borderSolid: '#d6e1ed', radius: '0.375rem',
    font: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    isDark: false,
  },
  {
    id: 'athlete',
    name: 'Athlete',
    bg: '#0a0a0a', surface: '#111111', surfaceElevated: '#1a1a1a',
    textPrimary: '#ffffff', textSecondary: '#a3a3a3', textMuted: '#666666',
    accent: '#c6f135', accentBg: '#c6f135', accentText: '#000000',
    statusGreen: '#76b900', statusYellow: '#f5a623', statusRed: '#e52020',
    borderSolid: '#2a2a2a', radius: '0.1875rem',
    font: "system-ui, 'Helvetica Neue', Arial, sans-serif",
    isDark: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    bg: '#ffffff', surface: '#ffffff', surfaceElevated: '#eef0f3',
    textPrimary: '#0a0b0d', textSecondary: '#5b616e', textMuted: '#8a8f98',
    accent: '#0052ff', accentBg: '#0052ff', accentText: '#ffffff',
    statusGreen: '#149e61', statusYellow: '#9b6829', statusRed: '#cf202f',
    borderSolid: '#dedee5', radius: '0.5rem',
    font: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    isDark: false,
  },
  {
    id: 'kraken',
    name: 'Kraken',
    bg: '#ffffff', surface: '#ffffff', surfaceElevated: '#f5f5f7',
    textPrimary: '#101114', textSecondary: '#686b82', textMuted: '#9497a9',
    accent: '#7132f5', accentBg: '#7132f5', accentText: '#ffffff',
    statusGreen: '#149e61', statusYellow: '#f59e0b', statusRed: '#ef4444',
    borderSolid: '#dedee5', radius: '0.75rem',
    font: "'Inter', 'IBM Plex Sans', Helvetica, Arial, sans-serif",
    isDark: false,
  },
];

const STYLE_TAG_ID = 'design-system-theme';
type ThemeMode = 'light' | 'dark';

function buildModeVars(theme: DesignSystemTheme, mode: ThemeMode): Record<string, string> {
  const bg = hexToHSLObject(theme.bg);
  const surface = hexToHSLObject(theme.surface);
  const elevated = hexToHSLObject(theme.surfaceElevated);
  const textPrimary = hexToHSLObject(theme.textPrimary);
  const textSecondary = hexToHSLObject(theme.textSecondary);
  const textMuted = hexToHSLObject(theme.textMuted);
  const border = hexToHSLObject(theme.borderSolid);

  const isNativeMode = (mode === 'dark' && theme.isDark) || (mode === 'light' && !theme.isDark);

  const background = isNativeMode
    ? hexToHSL(theme.bg)
    : mode === 'light'
      ? toneFrom(bg, { s: Math.min(bg.s, 12), l: 97 })
      : toneFrom(bg, { s: clamp(Math.max(bg.s, 10), 10, 28), l: 8 });

  const card = isNativeMode
    ? hexToHSL(theme.surface)
    : mode === 'light'
      ? toneFrom(surface, { s: Math.min(surface.s, 10), l: 100 })
      : toneFrom(surface, { s: clamp(Math.max(surface.s, 10), 10, 24), l: 12 });

  const secondary = isNativeMode
    ? hexToHSL(theme.surfaceElevated)
    : mode === 'light'
      ? toneFrom(elevated, { s: Math.min(elevated.s, 12), l: 94 })
      : toneFrom(elevated, { s: clamp(Math.max(elevated.s, 12), 12, 26), l: 18 });

  const foreground = isNativeMode
    ? hexToHSL(theme.textPrimary)
    : mode === 'light'
      ? toneFrom(textPrimary, { s: clamp(textPrimary.s, 0, 18), l: 12 })
      : toneFrom(textPrimary, { s: clamp(Math.max(textPrimary.s, 6), 6, 20), l: 96 });

  const secondaryForeground = isNativeMode
    ? hexToHSL(theme.textSecondary)
    : mode === 'light'
      ? toneFrom(textSecondary, { s: clamp(textSecondary.s, 0, 24), l: 32 })
      : toneFrom(textSecondary, { s: clamp(Math.max(textSecondary.s, 8), 8, 20), l: 74 });

  const mutedForeground = isNativeMode
    ? hexToHSL(theme.textMuted)
    : mode === 'light'
      ? toneFrom(textMuted, { s: clamp(textMuted.s, 0, 18), l: 46 })
      : toneFrom(textMuted, { s: clamp(Math.max(textMuted.s, 6), 6, 16), l: 60 });

  const borderColor = isNativeMode
    ? hexToHSL(theme.borderSolid)
    : mode === 'light'
      ? toneFrom(border, { s: clamp(border.s, 0, 14), l: 88 })
      : toneFrom(border, { s: clamp(Math.max(border.s, 6), 6, 18), l: 24 });

  return {
    '--background': background,
    '--foreground': foreground,
    '--card': card,
    '--card-foreground': foreground,
    '--popover': card,
    '--popover-foreground': foreground,
    '--primary': hexToHSL(theme.accentBg),
    '--primary-foreground': hexToHSL(theme.accentText),
    '--secondary': secondary,
    '--secondary-foreground': secondaryForeground,
    '--muted': secondary,
    '--muted-foreground': mutedForeground,
    '--accent': hexToHSL(theme.accent),
    '--accent-foreground': hexToHSL(theme.accentText),
    '--border': borderColor,
    '--input': borderColor,
    '--ring': hexToHSL(theme.accent),
    '--status-active': hexToHSL(theme.statusGreen),
    '--status-warning': hexToHSL(theme.statusYellow),
    '--status-caution': hexToHSL(theme.statusYellow),
    '--status-danger': hexToHSL(theme.statusRed),
    '--sidebar-background': card,
    '--sidebar-foreground': secondaryForeground,
    '--sidebar-primary': hexToHSL(theme.accentBg),
    '--sidebar-primary-foreground': hexToHSL(theme.accentText),
    '--sidebar-accent': secondary,
    '--sidebar-accent-foreground': secondaryForeground,
    '--sidebar-border': borderColor,
    '--sidebar-ring': hexToHSL(theme.accent),
    '--radius': theme.radius,
  };
}

function varsToCSS(vars: Record<string, string>): string {
  return Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`).join('\n');
}

function applyThemeToDOM(theme: DesignSystemTheme) {
  let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_TAG_ID;
    document.head.appendChild(styleEl);
  }

  const darkVars = buildModeVars(theme, 'dark');
  const lightVars = buildModeVars(theme, 'light');

  styleEl.textContent = `
:root {
${varsToCSS(darkVars)}
}
.light {
${varsToCSS(lightVars)}
}
`;

  document.body.style.fontFamily = theme.font;
  if (theme.displayFont) {
    document.documentElement.style.setProperty('--font-display', theme.displayFont);
  }
}

function clearThemeFromDOM() {
  const styleEl = document.getElementById(STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
  document.body.style.fontFamily = '';
  document.documentElement.style.removeProperty('--font-display');
}

interface DesignSystemContextValue {
  activeSystemId: string;
  activeSystem: DesignSystemTheme;
  setSystem: (id: string, teamId?: string) => Promise<void>;
  resetToDefault: (teamId?: string) => Promise<void>;
  systems: DesignSystemTheme[];
  loading: boolean;
}

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  const activeSystem = DESIGN_SYSTEMS.find(s => s.id === activeId) || DESIGN_SYSTEMS[0];

  useEffect(() => {
    async function fetchTheme() {
      try {
        const { data } = await supabase
          .from('teams')
          .select('design_system')
          .limit(1)
          .maybeSingle();

        if (data?.design_system) {
          setActiveId(data.design_system);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }

    fetchTheme();
  }, []);

  useEffect(() => {
    if (activeId === 'default') {
      clearThemeFromDOM();
    } else {
      applyThemeToDOM(activeSystem);
    }
  }, [activeId, activeSystem]);

  const setSystem = useCallback(async (id: string, teamId?: string) => {
    setActiveId(id);

    if (teamId) {
      await supabase
        .from('teams')
        .update({ design_system: id } as never)
        .eq('id', teamId);
    }
  }, []);

  const resetToDefault = useCallback(async (teamId?: string) => {
    setActiveId('default');
    clearThemeFromDOM();

    if (teamId) {
      await supabase
        .from('teams')
        .update({ design_system: 'default' } as never)
        .eq('id', teamId);
    }
  }, []);

  return (
    <DesignSystemContext.Provider value={{
      activeSystemId: activeId,
      activeSystem,
      setSystem,
      resetToDefault,
      systems: DESIGN_SYSTEMS,
      loading,
    }}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem() {
  const ctx = useContext(DesignSystemContext);
  if (!ctx) throw new Error('useDesignSystem must be used within DesignSystemProvider');
  return ctx;
}
