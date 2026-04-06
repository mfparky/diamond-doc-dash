import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Hex → HSL conversion
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

function applyThemeToDOM(theme: DesignSystemTheme) {
  const root = document.documentElement;

  if (theme.isDark) {
    root.classList.remove('light');
  } else {
    root.classList.add('light');
  }

  const vars: Record<string, string> = {
    '--background': hexToHSL(theme.bg),
    '--foreground': hexToHSL(theme.textPrimary),
    '--card': hexToHSL(theme.surface),
    '--card-foreground': hexToHSL(theme.textPrimary),
    '--popover': hexToHSL(theme.surface),
    '--popover-foreground': hexToHSL(theme.textPrimary),
    '--primary': hexToHSL(theme.accentBg),
    '--primary-foreground': hexToHSL(theme.accentText),
    '--secondary': hexToHSL(theme.surfaceElevated),
    '--secondary-foreground': hexToHSL(theme.textSecondary),
    '--muted': hexToHSL(theme.surfaceElevated),
    '--muted-foreground': hexToHSL(theme.textMuted),
    '--accent': hexToHSL(theme.accent),
    '--accent-foreground': hexToHSL(theme.accentText),
    '--border': hexToHSL(theme.borderSolid),
    '--input': hexToHSL(theme.borderSolid),
    '--ring': hexToHSL(theme.accent),
    '--status-active': hexToHSL(theme.statusGreen),
    '--status-warning': hexToHSL(theme.statusYellow),
    '--status-caution': hexToHSL(theme.statusYellow),
    '--status-danger': hexToHSL(theme.statusRed),
    '--sidebar-background': hexToHSL(theme.surface),
    '--sidebar-foreground': hexToHSL(theme.textSecondary),
    '--sidebar-primary': hexToHSL(theme.accentBg),
    '--sidebar-primary-foreground': hexToHSL(theme.accentText),
    '--sidebar-accent': hexToHSL(theme.surfaceElevated),
    '--sidebar-accent-foreground': hexToHSL(theme.textSecondary),
    '--sidebar-border': hexToHSL(theme.borderSolid),
    '--sidebar-ring': hexToHSL(theme.accent),
    '--radius': theme.radius,
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  document.body.style.fontFamily = theme.font;
  if (theme.displayFont) {
    root.style.setProperty('--font-display', theme.displayFont);
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

  // On mount, fetch team's design_system from DB
  useEffect(() => {
    async function fetchTheme() {
      try {
        // Get first team's design_system (works for both anon and authenticated)
        const { data } = await supabase
          .from('teams')
          .select('design_system')
          .limit(1)
          .maybeSingle();

        if (data?.design_system) {
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

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    if (activeId === 'default') {
      clearThemeFromDOM();
    } else {
      applyThemeToDOM(activeSystem);
    }
  }, [activeId, activeSystem]);

  const setSystem = useCallback(async (id: string, teamId?: string) => {
    setActiveId(id);

    // If teamId provided, persist to DB (coach only)
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
