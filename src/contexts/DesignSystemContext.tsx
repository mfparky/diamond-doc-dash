import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Hex → HSL conversion ──────────────────────────────────────────────────────

function hexToHSL(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ─── Theme Shape ────────────────────────────────────────────────────────────────

export interface ThemeVariant {
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
  isDark: boolean;
}

export interface DesignSystemTheme {
  id: string;
  name: string;
  radius: string;
  font: string;
  displayFont?: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

// ─── Design System Definition ────────────────────────────────────────────────
//
// One brand identity for the whole product: "Athlete" (Nike/UA-inspired —
// near-black/white surfaces, electric volt-green accent, high-contrast,
// sunlight-readable — a good match for a coach reading this off a phone in
// a bright dugout). Previously this held 9 selectable themes (Linear, Apple,
// Stripe, Coinbase, Kraken, Spotify, Supabase, plus a "default" green/gold
// look); simplified down to just this one, with light/dark variants.
//
// Status colors (statusGreen/Yellow/Red — Ready/Caution/Rest) are NOT
// customized per team, even once team accent-color branding is layered on
// top of this: a coach needs red to always mean "rest" regardless of which
// team's colors are showing elsewhere on the page.

const ATHLETE_THEME: DesignSystemTheme = {
  id: 'athlete',
  name: 'Athlete',
  radius: '0.1875rem',
  font: "system-ui, 'Helvetica Neue', Arial, sans-serif",
  dark: {
    bg: '#0a0a0a', surface: '#111111', surfaceElevated: '#1a1a1a',
    textPrimary: '#ffffff', textSecondary: '#a3a3a3', textMuted: '#666666',
    accent: '#c6f135', accentBg: '#c6f135', accentText: '#000000',
    statusGreen: '#76b900', statusYellow: '#f5a623', statusRed: '#e52020',
    borderSolid: '#2a2a2a', isDark: true,
  },
  light: {
    bg: '#ffffff', surface: '#f5f5f5', surfaceElevated: '#ebebeb',
    textPrimary: '#000000', textSecondary: '#3d3d3d', textMuted: '#707070',
    accent: '#76b900', accentBg: '#76b900', accentText: '#000000',
    statusGreen: '#4a7a00', statusYellow: '#c47f00', statusRed: '#cc1a1a',
    borderSolid: '#d0d0d0', isDark: false,
  },
};

export const DESIGN_SYSTEMS: DesignSystemTheme[] = [ATHLETE_THEME];

// ─── Apply / Clear Theme ────────────────────────────────────────────────────────

function applyThemeToDOM(system: DesignSystemTheme, mode: 'light' | 'dark') {
  const v = mode === 'dark' ? system.dark : system.light;
  const root = document.documentElement;

  if (v.isDark) {
    root.classList.remove('light');
  } else {
    root.classList.add('light');
  }

  // Helper: handle rgba() strings by converting them to an opaque approximation for HSL
  function toHSL(color: string): string {
    if (color.startsWith('rgba')) {
      // Extract rgb values from rgba and ignore alpha for CSS var purposes
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const hex = '#' + [match[1], match[2], match[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
        return hexToHSL(hex);
      }
    }
    return hexToHSL(color);
  }

  const vars: Record<string, string> = {
    '--background': toHSL(v.bg),
    '--foreground': toHSL(v.textPrimary),
    '--card': toHSL(v.surface),
    '--card-foreground': toHSL(v.textPrimary),
    '--popover': toHSL(v.surface),
    '--popover-foreground': toHSL(v.textPrimary),
    '--primary': toHSL(v.accentBg),
    '--primary-foreground': toHSL(v.accentText),
    '--secondary': toHSL(v.surfaceElevated),
    '--secondary-foreground': toHSL(v.textSecondary),
    '--muted': toHSL(v.surfaceElevated),
    '--muted-foreground': toHSL(v.textMuted),
    '--accent': toHSL(v.accent),
    '--accent-foreground': toHSL(v.accentText),
    '--border': toHSL(v.borderSolid),
    '--input': toHSL(v.borderSolid),
    '--ring': toHSL(v.accent),
    '--status-active': toHSL(v.statusGreen),
    '--status-warning': toHSL(v.statusYellow),
    '--status-caution': toHSL(v.statusYellow),
    '--status-danger': toHSL(v.statusRed),
    '--sidebar-background': toHSL(v.surface),
    '--sidebar-foreground': toHSL(v.textSecondary),
    '--sidebar-primary': toHSL(v.accentBg),
    '--sidebar-primary-foreground': toHSL(v.accentText),
    '--sidebar-accent': toHSL(v.surfaceElevated),
    '--sidebar-accent-foreground': toHSL(v.textSecondary),
    '--sidebar-border': toHSL(v.borderSolid),
    '--sidebar-ring': toHSL(v.accent),
    '--radius': system.radius,
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  document.body.style.fontFamily = system.font;
  if (system.displayFont) {
    root.style.setProperty('--font-display', system.displayFont);
  }
}

// ─── Context ────────────────────────────────────────────────────────────────────

interface DesignSystemContextValue {
  activeSystemId: string;
  activeSystem: DesignSystemTheme;
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
  toggleMode: () => void;
  setSystem: (id: string, teamId?: string) => Promise<void>;
  resetToDefault: (teamId?: string) => Promise<void>;
  systems: DesignSystemTheme[];
  loading: boolean;
}

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  // Only one design system exists now (Athlete), so activeId is always
  // 'athlete' — kept as state/context API rather than a constant so a
  // future second system (if ever needed) doesn't require another rewrite
  // of every call site.
  const [activeId, setActiveId] = useState<string>('athlete');
  const [mode, setModeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ds-mode');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  // No team is known yet at mount — callers apply a specific team's theme
  // once they've resolved which team they're for (see setSystem below,
  // called without a teamId to apply-without-persisting). Starts "not
  // loading" since there's nothing to wait on here anymore.
  const [loading, setLoading] = useState(false);

  const activeSystem = DESIGN_SYSTEMS.find(s => s.id === activeId) || DESIGN_SYSTEMS[0];

  // Apply theme to DOM whenever system or mode changes. Always explicit now
  // — there's no more "clear to CSS baseline" fallback state, since Athlete
  // IS the baseline.
  useEffect(() => {
    applyThemeToDOM(activeSystem, mode);
  }, [activeId, activeSystem, mode]);

  const setMode = useCallback((newMode: 'light' | 'dark') => {
    setModeState(newMode);
    localStorage.setItem('ds-mode', newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const setSystem = useCallback(async (id: string, teamId?: string) => {
    setActiveId(id);

    if (teamId) {
      await supabase
        .from('teams')
        .update({ design_system: id } as any)
        .eq('id', teamId);
    }
  }, []);

  const resetToDefault = useCallback(async (teamId?: string) => {
    setActiveId('athlete');

    if (teamId) {
      await supabase
        .from('teams')
        .update({ design_system: 'athlete' } as any)
        .eq('id', teamId);
    }
  }, []);

  return (
    <DesignSystemContext.Provider value={{
      activeSystemId: activeId,
      activeSystem,
      mode,
      setMode,
      toggleMode,
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
