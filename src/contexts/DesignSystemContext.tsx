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

// ─── Design System Definitions (light + dark pairs) ─────────────────────────────

export const DESIGN_SYSTEMS: DesignSystemTheme[] = [
  {
    id: 'default',
    name: 'Arm Stats (Default)',
    radius: '0.75rem',
    font: "'Inter', system-ui, sans-serif",
    displayFont: "'Space Grotesk', sans-serif",
    dark: {
      bg: '#0f1517', surface: '#1b2022', surfaceElevated: '#242c2f',
      textPrimary: '#f4f4ef', textSecondary: '#b8c2c5', textMuted: '#7f9295',
      accent: '#4abe7a', accentBg: '#2d8c4e', accentText: '#f4f4ef',
      statusGreen: '#4abe7a', statusYellow: '#f59e0a', statusRed: '#ef4444',
      borderSolid: '#2d3436', isDark: true,
    },
    light: {
      bg: '#faf9f5', surface: '#ffffff', surfaceElevated: '#f0efea',
      textPrimary: '#141e22', textSecondary: '#3d5055', textMuted: '#7a8c90',
      accent: '#3db36a', accentBg: '#2d8c4e', accentText: '#ffffff',
      statusGreen: '#2d8c4e', statusYellow: '#c47a00', statusRed: '#c0392b',
      borderSolid: '#dde0e2', isDark: false,
    },
  },
  {
    id: 'linear',
    name: 'Linear',
    radius: '0.375rem',
    font: "'Inter', -apple-system, system-ui, sans-serif",
    dark: {
      bg: '#08090a', surface: '#191a1b', surfaceElevated: '#28282c',
      textPrimary: '#f7f8f8', textSecondary: '#d0d6e0', textMuted: '#8a8f98',
      accent: '#5e6ad2', accentBg: '#5e6ad2', accentText: '#ffffff',
      statusGreen: '#27a644', statusYellow: '#f59e0b', statusRed: '#ef4444',
      borderSolid: '#23252a', isDark: true,
    },
    light: {
      bg: '#f7f8f8', surface: '#ffffff', surfaceElevated: '#f3f4f5',
      textPrimary: '#1d1f24', textSecondary: '#4e5460', textMuted: '#8a8f98',
      accent: '#5e6ad2', accentBg: '#5e6ad2', accentText: '#ffffff',
      statusGreen: '#1a7f37', statusYellow: '#8c5a00', statusRed: '#c9252d',
      borderSolid: '#e6e6e6', isDark: false,
    },
  },
  {
    id: 'apple',
    name: 'Apple',
    radius: '0.75rem',
    font: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    light: {
      bg: '#f5f5f7', surface: '#ffffff', surfaceElevated: '#fafafc',
      textPrimary: '#1d1d1f', textSecondary: '#6e6e73', textMuted: '#86868b',
      accent: '#0071e3', accentBg: '#0071e3', accentText: '#ffffff',
      statusGreen: '#1a7f37', statusYellow: '#9e5a00', statusRed: '#c0392b',
      borderSolid: '#d2d2d7', isDark: false,
    },
    dark: {
      bg: '#000000', surface: '#1c1c1e', surfaceElevated: '#2c2c2e',
      textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.60)', textMuted: 'rgba(255,255,255,0.40)',
      accent: '#0a84ff', accentBg: '#0a84ff', accentText: '#ffffff',
      statusGreen: '#30d158', statusYellow: '#ffd60a', statusRed: '#ff453a',
      borderSolid: 'rgba(255,255,255,0.18)', isDark: true,
    },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    radius: '0.375rem',
    font: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    light: {
      bg: '#f6f9fc', surface: '#ffffff', surfaceElevated: '#f0f4f9',
      textPrimary: '#061b31', textSecondary: '#273951', textMuted: '#64748d',
      accent: '#533afd', accentBg: '#533afd', accentText: '#ffffff',
      statusGreen: '#108c3d', statusYellow: '#9b6829', statusRed: '#c0145c',
      borderSolid: '#d6e1ed', isDark: false,
    },
    dark: {
      bg: '#1c1e54', surface: '#14163c', surfaceElevated: '#1e2060',
      textPrimary: '#ffffff', textSecondary: '#b9b9f9', textMuted: 'rgba(185,185,249,0.55)',
      accent: '#665efd', accentBg: '#533afd', accentText: '#ffffff',
      statusGreen: '#15be53', statusYellow: '#fcd34d', statusRed: '#ea2261',
      borderSolid: 'rgba(185,185,249,0.25)', isDark: true,
    },
  },
  {
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
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    radius: '0.5rem',
    font: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    light: {
      bg: '#ffffff', surface: '#ffffff', surfaceElevated: '#eef0f3',
      textPrimary: '#0a0b0d', textSecondary: '#5b616e', textMuted: '#8a8f98',
      accent: '#0052ff', accentBg: '#0052ff', accentText: '#ffffff',
      statusGreen: '#149e61', statusYellow: '#9b6829', statusRed: '#cf202f',
      borderSolid: '#dedee5', isDark: false,
    },
    dark: {
      bg: '#0a0b0d', surface: '#141519', surfaceElevated: '#1e1f25',
      textPrimary: '#f8f8f8', textSecondary: '#a1a5ad', textMuted: '#6b6f7a',
      accent: '#3773f5', accentBg: '#3773f5', accentText: '#ffffff',
      statusGreen: '#0caa5f', statusYellow: '#f5a623', statusRed: '#e5484d',
      borderSolid: '#2a2b32', isDark: true,
    },
  },
  {
    id: 'kraken',
    name: 'Kraken',
    radius: '0.75rem',
    font: "'Inter', 'IBM Plex Sans', Helvetica, Arial, sans-serif",
    light: {
      bg: '#ffffff', surface: '#ffffff', surfaceElevated: '#f5f5f7',
      textPrimary: '#101114', textSecondary: '#686b82', textMuted: '#9497a9',
      accent: '#7132f5', accentBg: '#7132f5', accentText: '#ffffff',
      statusGreen: '#149e61', statusYellow: '#f59e0b', statusRed: '#ef4444',
      borderSolid: '#dedee5', isDark: false,
    },
    dark: {
      bg: '#0e0f14', surface: '#181a22', surfaceElevated: '#22242e',
      textPrimary: '#f0f0f4', textSecondary: '#9497a9', textMuted: '#686b82',
      accent: '#8b5cf6', accentBg: '#7132f5', accentText: '#ffffff',
      statusGreen: '#0caa5f', statusYellow: '#f5a623', statusRed: '#ef4444',
      borderSolid: '#2a2c38', isDark: true,
    },
  },
  {
    id: 'spotify',
    name: 'Spotify',
    radius: '9999px',
    font: "system-ui, 'Helvetica Neue', Arial, sans-serif",
    dark: {
      bg: '#121212', surface: '#181818', surfaceElevated: '#252525',
      textPrimary: '#ffffff', textSecondary: '#b3b3b3', textMuted: '#727272',
      accent: '#1ed760', accentBg: '#1ed760', accentText: '#000000',
      statusGreen: '#1ed760', statusYellow: '#ffa42b', statusRed: '#f3727f',
      borderSolid: '#333333', isDark: true,
    },
    light: {
      bg: '#ffffff', surface: '#f6f6f6', surfaceElevated: '#eeeeee',
      textPrimary: '#121212', textSecondary: '#535353', textMuted: '#888888',
      accent: '#1db954', accentBg: '#1db954', accentText: '#ffffff',
      statusGreen: '#1db954', statusYellow: '#e8a700', statusRed: '#e22134',
      borderSolid: '#d9d9d9', isDark: false,
    },
  },
  {
    id: 'supabase',
    name: 'Supabase',
    radius: '0.375rem',
    font: "'Inter', system-ui, sans-serif",
    dark: {
      bg: '#171717', surface: '#1f1f1f', surfaceElevated: '#2a2a2a',
      textPrimary: '#fafafa', textSecondary: '#b4b4b4', textMuted: '#898989',
      accent: '#3ecf8e', accentBg: '#3ecf8e', accentText: '#0f0f0f',
      statusGreen: '#3ecf8e', statusYellow: '#f5a623', statusRed: '#ef4444',
      borderSolid: '#2e2e2e', isDark: true,
    },
    light: {
      bg: '#f8f8f8', surface: '#ffffff', surfaceElevated: '#f0f0f0',
      textPrimary: '#171717', textSecondary: '#4d4d4d', textMuted: '#898989',
      accent: '#00c573', accentBg: '#00c573', accentText: '#ffffff',
      statusGreen: '#00c573', statusYellow: '#c47a00', statusRed: '#c0392b',
      borderSolid: '#e0e0e0', isDark: false,
    },
  },
];

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

function clearThemeFromDOM() {
  const root = document.documentElement;
  const varsToClear = [
    '--background', '--foreground', '--card', '--card-foreground',
    '--popover', '--popover-foreground', '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
    '--accent', '--accent-foreground', '--border', '--input', '--ring',
    '--status-active', '--status-warning', '--status-caution', '--status-danger',
    '--sidebar-background', '--sidebar-foreground', '--sidebar-primary',
    '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground',
    '--sidebar-border', '--sidebar-ring', '--radius',
  ];
  varsToClear.forEach(v => root.style.removeProperty(v));
  document.body.style.fontFamily = '';
  root.style.removeProperty('--font-display');
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
  const [activeId, setActiveId] = useState<string>('default');
  const [mode, setModeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ds-mode');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [loading, setLoading] = useState(true);

  const activeSystem = DESIGN_SYSTEMS.find(s => s.id === activeId) || DESIGN_SYSTEMS[0];

  // On mount, fetch team's design_system from DB
  useEffect(() => {
    async function fetchTheme() {
      try {
        const { data } = await supabase
          .from('teams')
          .select('design_system')
          .limit(1)
          .maybeSingle();

        if (data?.design_system && data.design_system !== 'default') {
          setActiveId(data.design_system);
        }
      } catch {
        // Fall back to default
      } finally {
        setLoading(false);
      }
    }
    fetchTheme();
  }, []);

  // Apply theme to DOM whenever system or mode changes
  useEffect(() => {
    if (activeId === 'default' && mode === 'dark') {
      clearThemeFromDOM();
      document.documentElement.classList.remove('light');
    } else if (activeId === 'default' && mode === 'light') {
      // Apply the default light variant
      applyThemeToDOM(activeSystem, 'light');
    } else {
      applyThemeToDOM(activeSystem, mode);
    }
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
    setActiveId('default');
    clearThemeFromDOM();

    if (teamId) {
      await supabase
        .from('teams')
        .update({ design_system: 'default' } as any)
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
