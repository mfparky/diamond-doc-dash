import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, BarChart3, TrendingUp, Target, Gauge, Calendar, Share2, Check, X, Sun, Moon, Paintbrush, RotateCcw, Lock } from 'lucide-react';
import { useDesignSystem, DESIGN_SYSTEMS } from '@/contexts/DesignSystemContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Theme Definitions ────────────────────────────────────────────────────────

const LINEAR = {
  name: 'Linear',
  tagline: 'Precision engineering — dark-native, indigo-violet accent, tight negative tracking',
  font: `'Inter', -apple-system, system-ui, sans-serif`,
  isDark: true,

  bg: '#08090a',
  surface: '#191a1b',
  surfaceElevated: '#28282c',
  border: 'rgba(255,255,255,0.08)',
  borderSolid: '#23252a',

  textPrimary: '#f7f8f8',
  textSecondary: '#d0d6e0',
  textMuted: '#8a8f98',
  textSubtle: '#62666d',

  accent: '#7170ff',
  accentBg: '#5e6ad2',
  accentText: '#ffffff',

  statusGreen: '#27a644',
  statusGreenBg: 'rgba(39,166,68,0.12)',
  statusYellow: '#f59e0b',
  statusYellowBg: 'rgba(245,158,11,0.12)',
  statusRed: '#ef4444',
  statusRedBg: 'rgba(239,68,68,0.12)',

  radius: '6px',
  radiusSm: '4px',
  radiusLg: '10px',
  radiusBtn: '6px',

  displayWeight: 600,
  displayTracking: '-0.8px',
  labelUppercase: false,
  labelTracking: 'normal',

  shadow: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.4)',
};

const APPLE = {
  name: 'Apple',
  tagline: 'SF Pro, clean light surfaces, single blue accent, pill CTAs — premium & familiar',
  font: `'SF Pro Display', 'SF Pro Text', -apple-system, 'Helvetica Neue', sans-serif`,
  isDark: false,

  bg: '#f5f5f7',
  surface: '#ffffff',
  surfaceElevated: '#fafafc',
  border: 'rgba(0,0,0,0.08)',
  borderSolid: 'rgba(0,0,0,0.12)',

  textPrimary: '#1d1d1f',
  textSecondary: 'rgba(0,0,0,0.64)',
  textMuted: 'rgba(0,0,0,0.48)',
  textSubtle: 'rgba(0,0,0,0.28)',

  accent: '#0071e3',
  accentBg: '#0071e3',
  accentText: '#ffffff',

  statusGreen: '#1a7f37',
  statusGreenBg: 'rgba(26,127,55,0.10)',
  statusYellow: '#9e5a00',
  statusYellowBg: 'rgba(158,90,0,0.10)',
  statusRed: '#c0392b',
  statusRedBg: 'rgba(192,57,43,0.10)',

  radius: '12px',
  radiusSm: '8px',
  radiusLg: '18px',
  radiusBtn: '980px',

  displayWeight: 600,
  displayTracking: '-0.3px',
  labelUppercase: false,
  labelTracking: 'normal',

  shadow: 'rgba(0,0,0,0.12) 0px 4px 20px 0px',
};

const STRIPE = {
  name: 'Stripe',
  tagline: 'sohne-var weight 300 headlines, deep navy, purple accent, blue-tinted shadows — premium trust',
  font: `'sohne-var', 'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif`,
  isDark: false,

  bg: '#f6f9fc',
  surface: '#ffffff',
  surfaceElevated: '#f0f4f9',
  border: '#e5edf5',
  borderSolid: '#d6e1ed',

  textPrimary: '#061b31',
  textSecondary: '#273951',
  textMuted: '#64748d',
  textSubtle: '#8898b0',

  accent: '#533afd',
  accentBg: '#533afd',
  accentText: '#ffffff',

  statusGreen: '#108c3d',
  statusGreenBg: 'rgba(21,190,83,0.10)',
  statusYellow: '#9b6829',
  statusYellowBg: 'rgba(155,104,41,0.09)',
  statusRed: '#c0145c',
  statusRedBg: 'rgba(234,34,97,0.09)',

  radius: '6px',
  radiusSm: '4px',
  radiusLg: '8px',
  radiusBtn: '6px',

  // Stripe signature: weight 300 display — whisper authority, not brute force
  displayWeight: 300,
  displayTracking: '-0.96px',
  labelUppercase: false,
  labelTracking: 'normal',

  // Blue-tinted Stripe shadows
  shadow: 'rgba(50,50,93,0.20) 0px 6px 12px -2px, rgba(0,0,0,0.08) 0px 3px 7px -3px',
};

// Athlete: Nike/UA inspired — built on NVIDIA's electric green × black performance language
const ATHLETE = {
  name: 'Athlete',
  tagline: 'Nike/UA inspired — electric volt green, near-black, all-caps performance labels, no mercy margins',
  font: `system-ui, 'Helvetica Neue', Arial, sans-serif`,
  isDark: true,

  bg: '#0a0a0a',
  surface: '#111111',
  surfaceElevated: '#1a1a1a',
  border: 'rgba(255,255,255,0.07)',
  borderSolid: '#2a2a2a',

  textPrimary: '#ffffff',
  textSecondary: '#a3a3a3',
  textMuted: '#666666',
  textSubtle: '#3d3d3d',

  // Nike Volt — the most recognizable performance-sports accent on earth
  accent: '#c6f135',
  accentBg: '#c6f135',
  accentText: '#000000',

  statusGreen: '#76b900',   // NVIDIA green — electric, not soft
  statusGreenBg: 'rgba(118,185,0,0.14)',
  statusYellow: '#f5a623',
  statusYellowBg: 'rgba(245,166,35,0.14)',
  statusRed: '#e52020',
  statusRedBg: 'rgba(229,32,32,0.14)',

  radius: '3px',
  radiusSm: '2px',
  radiusLg: '4px',
  radiusBtn: '3px',

  displayWeight: 900,
  displayTracking: '-1px',
  labelUppercase: true,
  labelTracking: '0.1em',

  shadow: '0 0 0 1px rgba(198,241,53,0.12), 0 4px 20px rgba(0,0,0,0.6)',
};

// ─── Current App Design System (field green + warm gold + Space Grotesk) ─────

const CURRENT_DARK = {
  name: 'Current',
  tagline: 'Existing app — baseball field green, warm gold, Space Grotesk headings, dark-native',
  font: `'Space Grotesk', 'Inter', system-ui, sans-serif`,
  isDark: true,
  bg: '#0f1517', surface: '#1b2022', surfaceElevated: '#242c2f',
  border: 'rgba(255,255,255,0.08)', borderSolid: '#2d3436',
  textPrimary: '#f4f4ef', textSecondary: '#b8c2c5', textMuted: '#7f9295', textSubtle: '#4a5c5f',
  accent: '#4abe7a', accentBg: '#2d8c4e', accentText: '#f4f4ef',
  statusGreen: '#4abe7a', statusGreenBg: 'rgba(74,190,122,0.15)',
  statusYellow: '#f59e0a', statusYellowBg: 'rgba(245,158,10,0.15)',
  statusRed: '#ef4444', statusRedBg: 'rgba(239,68,68,0.15)',
  radius: '12px', radiusSm: '8px', radiusLg: '16px', radiusBtn: '12px',
  displayWeight: 700, displayTracking: '-0.3px',
  labelUppercase: false, labelTracking: 'normal',
  shadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)',
};

const CURRENT_LIGHT = {
  ...CURRENT_DARK,
  tagline: 'Existing app — baseball field green, warm gold, Space Grotesk headings, light mode',
  isDark: false,
  bg: '#faf9f5', surface: '#ffffff', surfaceElevated: '#f0efea',
  border: 'rgba(0,0,0,0.08)', borderSolid: '#dde0e2',
  textPrimary: '#141e22', textSecondary: '#3d5055', textMuted: '#7a8c90', textSubtle: '#b0bcbf',
  accent: '#3db36a', accentBg: '#2d8c4e', accentText: '#ffffff',
  statusGreen: '#2d8c4e', statusGreenBg: 'rgba(45,140,78,0.10)',
  statusYellow: '#c47a00', statusYellowBg: 'rgba(196,122,0,0.10)',
  statusRed: '#c0392b', statusRedBg: 'rgba(192,57,43,0.10)',
  shadow: 'rgba(0,0,0,0.08) 0px 4px 20px',
};

// ─── Light variants for the other 4 systems ───────────────────────────────────

const LINEAR_LIGHT = {
  ...LINEAR,
  tagline: 'Precision engineering — light mode, indigo accent on clean white surfaces',
  isDark: false,
  bg: '#f7f8f8', surface: '#ffffff', surfaceElevated: '#f3f4f5',
  border: '#d0d6e0', borderSolid: '#e6e6e6',
  textPrimary: '#1d1f24', textSecondary: '#4e5460', textMuted: '#8a8f98', textSubtle: '#c0c4cc',
  statusGreen: '#1a7f37', statusGreenBg: 'rgba(26,127,55,0.10)',
  statusYellow: '#8c5a00', statusYellowBg: 'rgba(140,90,0,0.10)',
  statusRed: '#c9252d', statusRedBg: 'rgba(201,37,45,0.10)',
  shadow: '0 0 0 1px #d0d6e0, 0 4px 16px rgba(0,0,0,0.06)',
};

const APPLE_DARK = {
  ...APPLE,
  tagline: 'iOS dark mode — pure black canvas, elevated grey surfaces, vibrant accent blue',
  isDark: true,
  bg: '#000000', surface: '#1c1c1e', surfaceElevated: '#2c2c2e',
  border: 'rgba(255,255,255,0.12)', borderSolid: 'rgba(255,255,255,0.18)',
  textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.60)',
  textMuted: 'rgba(255,255,255,0.40)', textSubtle: 'rgba(255,255,255,0.20)',
  accent: '#0a84ff', accentBg: '#0a84ff', accentText: '#ffffff',
  statusGreen: '#30d158', statusGreenBg: 'rgba(48,209,88,0.15)',
  statusYellow: '#ffd60a', statusYellowBg: 'rgba(255,214,10,0.15)',
  statusRed: '#ff453a', statusRedBg: 'rgba(255,69,58,0.15)',
  shadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const STRIPE_DARK = {
  ...STRIPE,
  tagline: 'Stripe brand dark — deep indigo canvas, lavender text, purple glow shadows',
  isDark: true,
  bg: '#1c1e54', surface: '#14163c', surfaceElevated: '#1e2060',
  border: 'rgba(185,185,249,0.15)', borderSolid: 'rgba(185,185,249,0.25)',
  textPrimary: '#ffffff', textSecondary: '#b9b9f9',
  textMuted: 'rgba(185,185,249,0.55)', textSubtle: 'rgba(185,185,249,0.28)',
  accent: '#665efd', accentBg: '#533afd', accentText: '#ffffff',
  statusGreen: '#15be53', statusGreenBg: 'rgba(21,190,83,0.15)',
  statusYellow: '#fcd34d', statusYellowBg: 'rgba(252,211,77,0.12)',
  statusRed: '#ea2261', statusRedBg: 'rgba(234,34,97,0.12)',
  shadow: 'rgba(83,58,253,0.35) 0px 6px 20px -2px, rgba(0,0,0,0.5) 0px 4px 12px -3px',
};

const ATHLETE_LIGHT = {
  ...ATHLETE,
  tagline: 'Nike/UA gameday light — white canvas, electric green, all-caps, sunlight-ready',
  isDark: false,
  bg: '#ffffff', surface: '#f5f5f5', surfaceElevated: '#ebebeb',
  border: 'rgba(0,0,0,0.08)', borderSolid: '#d0d0d0',
  textPrimary: '#000000', textSecondary: '#3d3d3d', textMuted: '#707070', textSubtle: '#b0b0b0',
  accent: '#76b900', accentBg: '#76b900', accentText: '#000000',
  statusGreen: '#4a7a00', statusGreenBg: 'rgba(74,122,0,0.10)',
  statusYellow: '#c47f00', statusYellowBg: 'rgba(196,127,0,0.10)',
  statusRed: '#cc1a1a', statusRedBg: 'rgba(204,26,26,0.10)',
  shadow: 'rgba(0,0,0,0.10) 0px 4px 20px',
};

const SPOTIFY_DARK = {
  name: 'Spotify',
  tagline: 'Immersive dark — Spotify green, pill buttons, uppercase labels, content-first theater',
  font: `system-ui, 'Helvetica Neue', Arial, sans-serif`,
  isDark: true,
  bg: '#121212', surface: '#181818', surfaceElevated: '#252525',
  border: 'rgba(255,255,255,0.08)', borderSolid: '#333333',
  textPrimary: '#ffffff', textSecondary: '#b3b3b3', textMuted: '#727272', textSubtle: '#404040',
  accent: '#1ed760', accentBg: '#1ed760', accentText: '#000000',
  statusGreen: '#1ed760', statusGreenBg: 'rgba(30,215,96,0.15)',
  statusYellow: '#ffa42b', statusYellowBg: 'rgba(255,164,43,0.15)',
  statusRed: '#f3727f', statusRedBg: 'rgba(243,114,127,0.15)',
  radius: '9999px', radiusSm: '9999px', radiusLg: '16px', radiusBtn: '9999px',
  displayWeight: 700, displayTracking: '-0.5px',
  labelUppercase: true, labelTracking: '0.1em',
  shadow: 'rgba(0,0,0,0.5) 0px 8px 24px',
};

const SPOTIFY_LIGHT = {
  ...SPOTIFY_DARK,
  tagline: 'Spotify light — clean white canvas, green accent, pill geometry',
  isDark: false,
  bg: '#ffffff', surface: '#f6f6f6', surfaceElevated: '#eeeeee',
  border: 'rgba(0,0,0,0.08)', borderSolid: '#d9d9d9',
  textPrimary: '#121212', textSecondary: '#535353', textMuted: '#888888', textSubtle: '#c0c0c0',
  accent: '#1db954', accentBg: '#1db954', accentText: '#ffffff',
  statusGreen: '#1db954', statusGreenBg: 'rgba(29,185,84,0.10)',
  statusYellow: '#e8a700', statusYellowBg: 'rgba(232,167,0,0.10)',
  statusRed: '#e22134', statusRedBg: 'rgba(226,33,52,0.10)',
  shadow: 'rgba(0,0,0,0.08) 0px 4px 20px',
};

const SUPABASE_DARK = {
  name: 'Supabase',
  tagline: 'Developer-native — emerald green on near-black, clean & authoritative, translucent layers',
  font: `'Inter', system-ui, sans-serif`,
  isDark: true,
  bg: '#171717', surface: '#1f1f1f', surfaceElevated: '#2a2a2a',
  border: 'rgba(255,255,255,0.08)', borderSolid: '#2e2e2e',
  textPrimary: '#fafafa', textSecondary: '#b4b4b4', textMuted: '#898989', textSubtle: '#4d4d4d',
  accent: '#3ecf8e', accentBg: '#3ecf8e', accentText: '#0f0f0f',
  statusGreen: '#3ecf8e', statusGreenBg: 'rgba(62,207,142,0.15)',
  statusYellow: '#f5a623', statusYellowBg: 'rgba(245,166,35,0.12)',
  statusRed: '#ef4444', statusRedBg: 'rgba(239,68,68,0.12)',
  radius: '6px', radiusSm: '4px', radiusLg: '8px', radiusBtn: '6px',
  displayWeight: 600, displayTracking: '-0.5px',
  labelUppercase: false, labelTracking: 'normal',
  shadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.4)',
};

const SUPABASE_LIGHT = {
  ...SUPABASE_DARK,
  tagline: 'Supabase light — clean white surfaces with emerald green accent',
  isDark: false,
  bg: '#f8f8f8', surface: '#ffffff', surfaceElevated: '#f0f0f0',
  border: 'rgba(0,0,0,0.08)', borderSolid: '#e0e0e0',
  textPrimary: '#171717', textSecondary: '#4d4d4d', textMuted: '#898989', textSubtle: '#c0c0c0',
  accent: '#00c573', accentBg: '#00c573', accentText: '#ffffff',
  statusGreen: '#00c573', statusGreenBg: 'rgba(0,197,115,0.10)',
  statusYellow: '#c47a00', statusYellowBg: 'rgba(196,122,0,0.10)',
  statusRed: '#c0392b', statusRedBg: 'rgba(192,57,43,0.10)',
  shadow: 'rgba(0,0,0,0.06) 0px 4px 16px',
};

type Theme = typeof LINEAR;

// ─── Shared Showcase Components ───────────────────────────────────────────────

function Section({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <h3 style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: t.labelUppercase ? '0.14em' : '0.08em',
        textTransform: 'uppercase',
        color: t.textMuted,
        marginBottom: '16px',
        borderBottom: `1px solid ${t.border}`,
        paddingBottom: '8px',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ColorPalette({ t }: { t: Theme }) {
  const swatches = [
    { label: 'BG', color: t.bg },
    { label: 'Surface', color: t.surface },
    { label: 'Elevated', color: t.surfaceElevated },
    { label: 'Accent', color: t.accentBg },
    { label: 'Green', color: t.statusGreen },
    { label: 'Yellow', color: t.statusYellow },
    { label: 'Red', color: t.statusRed },
  ];

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {swatches.map(s => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{
            width: '72px',
            height: '52px',
            background: s.color,
            borderRadius: t.radiusSm,
            border: `1px solid ${t.border}`,
          }} />
          <span style={{ fontSize: '10px', color: t.textMuted, textAlign: 'center', textTransform: t.labelUppercase ? 'uppercase' : 'none', letterSpacing: t.labelTracking }}>{s.label}</span>
          <span style={{ fontSize: '9px', color: t.textSubtle, textAlign: 'center', fontFamily: 'monospace' }}>{s.color}</span>
        </div>
      ))}
    </div>
  );
}

function TypographyScale({ t }: { t: Theme }) {
  const levels = [
    { label: 'Display', size: '36px', weight: t.displayWeight, tracking: t.displayTracking },
    { label: 'Heading', size: '24px', weight: Math.min(t.displayWeight, 700) as number, tracking: t.displayTracking },
    { label: 'Subheading', size: '18px', weight: 600, tracking: 'normal' },
    { label: 'Body', size: '15px', weight: 400, tracking: 'normal' },
    { label: 'Label', size: '11px', weight: 700, tracking: t.labelTracking },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {levels.map(l => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <span style={{
            fontSize: '10px',
            color: t.textMuted,
            width: '80px',
            flexShrink: 0,
            textTransform: t.labelUppercase ? 'uppercase' : 'none',
            letterSpacing: t.labelTracking,
          }}>{l.label}</span>
          <span style={{
            fontSize: l.size,
            fontWeight: l.weight,
            color: t.textPrimary,
            letterSpacing: l.tracking,
            lineHeight: 1.1,
            textTransform: (t.labelUppercase && l.label === 'Label') ? 'uppercase' : 'none',
          }}>
            {l.label === 'Label' ? (t.labelUppercase ? 'PITCH COUNT' : 'Pitch Count') : 'Pitch Tracker'}
          </span>
        </div>
      ))}
    </div>
  );
}

function ButtonSet({ t }: { t: Theme }) {
  const baseBtn: React.CSSProperties = {
    padding: '11px 22px',
    borderRadius: t.radiusBtn,
    fontFamily: t.font,
    fontSize: '14px',
    fontWeight: t.labelUppercase ? 800 : 600,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: t.labelTracking,
    textTransform: t.labelUppercase ? 'uppercase' : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
    lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Primary */}
      <button style={{ ...baseBtn, background: t.accentBg, color: t.accentText }}>
        <Plus size={14} />
        {t.labelUppercase ? 'LOG OUTING' : 'Log Outing'}
      </button>

      {/* Secondary */}
      <button style={{
        ...baseBtn,
        background: 'transparent',
        color: t.textSecondary,
        border: `1px solid ${t.border}`,
      }}>
        {t.labelUppercase ? 'VIEW STATS' : 'View Stats'}
      </button>

      {/* Ghost accent */}
      <button style={{
        ...baseBtn,
        background: 'transparent',
        color: t.accent,
        border: 'none',
        padding: '11px 14px',
      }}>
        {t.labelUppercase ? 'CANCEL' : 'Cancel'}
      </button>

      {/* Destructive */}
      <button style={{
        ...baseBtn,
        background: t.statusRedBg,
        color: t.statusRed,
        border: `1px solid ${t.statusRed}30`,
      }}>
        <X size={14} />
        {t.labelUppercase ? 'REMOVE' : 'Remove'}
      </button>
    </div>
  );
}

function StatusBadges({ t }: { t: Theme }) {
  const statuses = [
    { label: 'Ready', color: t.statusGreen, bg: t.statusGreenBg, dot: t.statusGreen },
    { label: 'Caution', color: t.statusYellow, bg: t.statusYellowBg, dot: t.statusYellow },
    { label: 'Rest', color: t.statusRed, bg: t.statusRedBg, dot: t.statusRed },
  ];

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {statuses.map(s => (
        <div key={s.label} style={{
          padding: '6px 14px',
          borderRadius: t.radius,
          fontSize: '12px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: s.bg,
          color: s.color,
          letterSpacing: t.labelUppercase ? '0.08em' : 'normal',
          textTransform: t.labelUppercase ? 'uppercase' : 'none',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, display: 'inline-block', flexShrink: 0 }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function StatChips({ t }: { t: Theme }) {
  const stats = [
    { label: 'Total Pitches', value: '1,240', highlight: false },
    { label: 'Strike %', value: '62%', highlight: true },
    { label: 'Max Velo', value: '86 mph', highlight: false },
    { label: 'Pitchers', value: '8', highlight: false },
  ];

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} style={{
          padding: '14px 18px',
          background: s.highlight ? `${t.accentBg}18` : t.surface,
          border: `1px solid ${s.highlight ? t.accent + '50' : t.border}`,
          borderRadius: t.radiusLg,
          minWidth: '100px',
          // Athlete gets a left-border accent strip
          borderLeft: (t.name === 'Athlete' && s.highlight) ? `3px solid ${t.accent}` : undefined,
        }}>
          <p style={{
            fontSize: '10px',
            color: t.textMuted,
            margin: '0 0 5px 0',
            textTransform: 'uppercase',
            letterSpacing: t.labelUppercase ? '0.12em' : '0.06em',
            fontWeight: 700,
          }}>
            {s.label}
          </p>
          <p style={{
            fontSize: '26px',
            fontWeight: t.displayWeight,
            color: s.highlight ? t.accent : t.textPrimary,
            margin: 0,
            letterSpacing: t.displayTracking,
            lineHeight: 1,
          }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PitcherCardDemo({ t }: { t: Theme }) {
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      // Athlete: sharp corner with a volt top-border accent
      borderTop: t.name === 'Athlete' ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
      borderRadius: t.radiusLg,
      padding: '16px',
      maxWidth: '320px',
      boxShadow: t.shadow,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p style={{
            fontSize: '18px',
            fontWeight: t.displayWeight,
            color: t.textPrimary,
            margin: 0,
            letterSpacing: t.displayTracking,
            textTransform: t.labelUppercase ? 'uppercase' : 'none',
          }}>
            {t.labelUppercase ? 'JAKE MARTINEZ' : 'Jake Martinez'}
          </p>
          <div style={{ marginTop: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: t.radius,
              background: t.statusGreenBg,
              color: t.statusGreen,
              letterSpacing: t.labelUppercase ? '0.08em' : 'normal',
              textTransform: t.labelUppercase ? 'uppercase' : 'none',
            }}>
              Ready
            </span>
          </div>
        </div>
        <button style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: t.textMuted,
          padding: '4px',
        }}>
          <Share2 size={16} />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[
          { icon: <TrendingUp size={14} />, label: '7-Day Pulse', value: '42' },
          { icon: <Target size={14} />, label: 'Strike %', value: '64%' },
          { icon: <Gauge size={14} />, label: 'Max Velo', value: '82 mph' },
          { icon: <Calendar size={14} />, label: 'Last Outing', value: 'Apr 3' },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              padding: '6px',
              borderRadius: t.radiusSm,
              background: `${t.accent}18`,
              color: t.accent,
              display: 'flex',
              flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <p style={{
                fontSize: '10px',
                color: t.textMuted,
                margin: 0,
                textTransform: t.labelUppercase ? 'uppercase' : 'none',
                letterSpacing: t.labelUppercase ? '0.06em' : 'normal',
                fontWeight: t.labelUppercase ? 700 : 400,
              }}>{stat.label}</p>
              <p style={{
                fontSize: '14px',
                fontWeight: 700,
                color: t.textPrimary,
                margin: 0,
                letterSpacing: t.name === 'Linear' ? '-0.2px' : 'normal',
              }}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogOutingForm({ t }: { t: Theme }) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    // Athlete: sharp corners on inputs, Apple: softer
    borderRadius: t.name === 'Apple' ? '10px' : t.radiusSm,
    color: t.textPrimary,
    fontSize: '15px',
    fontFamily: t.font,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: t.textMuted,
    marginBottom: '6px',
    display: 'block',
    letterSpacing: t.labelUppercase ? '0.1em' : '0.04em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderTop: t.name === 'Athlete' ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
      borderRadius: t.radiusLg,
      padding: '20px',
      maxWidth: '360px',
      boxShadow: t.shadow,
    }}>
      <p style={{
        fontSize: '20px',
        fontWeight: t.displayWeight,
        color: t.textPrimary,
        margin: '0 0 20px 0',
        letterSpacing: t.displayTracking,
        textTransform: t.labelUppercase ? 'uppercase' : 'none',
      }}>
        {t.labelUppercase ? 'LOG OUTING' : 'Log Outing'}
      </p>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Pitcher</label>
        <select style={{ ...inputStyle, appearance: 'none' }}>
          <option>Jake Martinez</option>
          <option>Cole Davis</option>
          <option>Ethan Brooks</option>
        </select>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Event Type</label>
        <select style={{ ...inputStyle, appearance: 'none' }}>
          <option>Game</option>
          <option>Practice</option>
          <option>Bullpen</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={labelStyle}>Pitches</label>
          <input type="number" placeholder="72" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Strikes</label>
          <input type="number" placeholder="48" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Max Velo (mph)</label>
        <input type="number" placeholder="84" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          placeholder="Good fastball command today..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{
          flex: 1,
          padding: '13px',
          borderRadius: t.radiusBtn,
          background: t.accentBg,
          color: t.accentText,
          fontWeight: 800,
          fontSize: '15px',
          border: 'none',
          cursor: 'pointer',
          fontFamily: t.font,
          letterSpacing: t.labelUppercase ? '0.08em' : 'normal',
          textTransform: t.labelUppercase ? 'uppercase' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <Check size={16} />
          {t.labelUppercase ? 'SAVE' : 'Save'}
        </button>
        <button style={{
          padding: '13px 20px',
          borderRadius: t.radiusBtn,
          background: 'transparent',
          color: t.textMuted,
          border: `1px solid ${t.border}`,
          fontWeight: 500,
          fontSize: '15px',
          cursor: 'pointer',
          fontFamily: t.font,
        }}>
          {t.labelUppercase ? 'CANCEL' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function BottomNavDemo({ t }: { t: Theme }) {
  return (
    <div style={{
      background: t.isDark ? t.surface : t.surface,
      borderTop: `1px solid ${t.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      height: '72px',
      maxWidth: '375px',
      borderRadius: `0 0 ${t.radiusLg} ${t.radiusLg}`,
      padding: '0 16px',
      boxShadow: t.shadow,
    }}>
      <button style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: t.accent, fontFamily: t.font, padding: '8px 16px',
      }}>
        <Users size={22} />
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: t.labelUppercase ? '0.08em' : 'normal', textTransform: t.labelUppercase ? 'uppercase' : 'none' }}>
          {t.labelUppercase ? 'PLAYERS' : 'Players'}
        </span>
      </button>

      <button style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: t.textMuted, fontFamily: t.font, padding: '4px 16px',
      }}>
        <div style={{
          width: '52px', height: '52px',
          borderRadius: '50%',
          background: t.accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.accentText,
          marginTop: '-20px',
          boxShadow: `0 4px 20px ${t.accentBg}70`,
        }}>
          <Plus size={24} />
        </div>
        <span style={{ fontSize: '10px', fontWeight: 600, color: t.textMuted, textTransform: t.labelUppercase ? 'uppercase' : 'none', letterSpacing: t.labelUppercase ? '0.08em' : 'normal' }}>
          Log
        </span>
      </button>

      <button style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: t.textMuted, fontFamily: t.font, padding: '8px 16px',
      }}>
        <BarChart3 size={22} />
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: t.labelUppercase ? 'uppercase' : 'none', letterSpacing: t.labelUppercase ? '0.08em' : 'normal' }}>
          Team
        </span>
      </button>
    </div>
  );
}

// ─── Full Showcase ─────────────────────────────────────────────────────────────

function DesignShowcase({ t }: { t: Theme }) {
  return (
    <div style={{
      background: t.bg,
      color: t.textPrimary,
      fontFamily: t.font,
      padding: '32px 24px 80px',
      minHeight: '100vh',
    }}>
      {/* Theme Header */}
      <div style={{ marginBottom: '40px', paddingBottom: '24px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '4px 12px',
          borderRadius: t.radius,
          background: `${t.accentBg}20`,
          border: `1px solid ${t.accent}35`,
          marginBottom: '12px',
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: t.accent,
            letterSpacing: '0.10em', textTransform: 'uppercase',
          }}>
            Design System
          </span>
        </div>
        <h2 style={{
          fontSize: '34px',
          fontWeight: t.displayWeight,
          margin: '0 0 8px',
          color: t.textPrimary,
          letterSpacing: t.displayTracking,
          textTransform: t.labelUppercase ? 'uppercase' : 'none',
        }}>
          {t.name}
        </h2>
        <p style={{ fontSize: '15px', color: t.textSecondary, margin: 0, maxWidth: '500px' }}>
          {t.tagline}
        </p>
      </div>

      <div style={{ maxWidth: '960px' }}>
        <Section t={t} title="Color Palette">
          <ColorPalette t={t} />
        </Section>

        <Section t={t} title="Typography Scale">
          <TypographyScale t={t} />
        </Section>

        <Section t={t} title="Buttons">
          <ButtonSet t={t} />
        </Section>

        <Section t={t} title="Arm Health Status">
          <StatusBadges t={t} />
        </Section>

        <Section t={t} title="Team Stats">
          <StatChips t={t} />
        </Section>

        <Section t={t} title="Pitcher Card">
          <PitcherCardDemo t={t} />
        </Section>

        <Section t={t} title="Log Outing Form">
          <LogOutingForm t={t} />
        </Section>

        <Section t={t} title="Bottom Navigation">
          <BottomNavDemo t={t} />
        </Section>
      </div>
    </div>
  );
}

// ─── Page Shell ────────────────────────────────────────────────────────────────

type ThemeKey = 'current' | 'linear' | 'apple' | 'stripe' | 'athlete' | 'spotify' | 'supabase';

const THEME_PAIRS: Record<ThemeKey, { light: Theme; dark: Theme; label: string; accent: string }> = {
  current:  { light: CURRENT_LIGHT,  dark: CURRENT_DARK,  label: 'Current',  accent: '#4abe7a' },
  linear:   { light: LINEAR_LIGHT,   dark: LINEAR,        label: 'Linear',   accent: '#7170ff' },
  apple:    { light: APPLE,          dark: APPLE_DARK,    label: 'Apple',    accent: '#0071e3' },
  stripe:   { light: STRIPE,         dark: STRIPE_DARK,   label: 'Stripe',   accent: '#533afd' },
  athlete:  { light: ATHLETE_LIGHT,  dark: ATHLETE,       label: 'Athlete',  accent: '#c6f135' },
  spotify:  { light: SPOTIFY_LIGHT,  dark: SPOTIFY_DARK,  label: 'Spotify',  accent: '#1ed760' },
  supabase: { light: SUPABASE_LIGHT, dark: SUPABASE_DARK, label: 'Supabase', accent: '#3ecf8e' },
};

export default function DesignSystemPage() {
  const [active, setActive] = useState<ThemeKey>('current');
  const { activeSystemId, mode, setMode, setSystem, resetToDefault, systems } = useDesignSystem();
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);

  // Local preview mode (synced with global mode initially)
  const [darkMode, setDarkMode] = useState(mode === 'dark');
  const pair = THEME_PAIRS[active];
  const t = darkMode ? pair.dark : pair.light;

  // Fetch the coach's team
  useEffect(() => {
    if (!user) return;
    supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTeamId(data.team_id);
      });
  }, [user]);

  const isCoach = !!user && !!teamId;

  // Map preview theme keys to design system IDs
  const themeKeyToSystemId: Record<ThemeKey, string> = {
    current: 'default',
    linear: 'linear',
    apple: 'apple',
    stripe: 'stripe',
    athlete: 'athlete',
    spotify: 'spotify',
    supabase: 'supabase',
  };

  const currentSystemId = themeKeyToSystemId[active];
  const isApplied = activeSystemId === currentSystemId;

  const handleApply = async () => {
    if (!isCoach) {
      toast.error('Sign in as a coach to change the global theme.');
      return;
    }
    await setSystem(currentSystemId, teamId!);
    // Also apply the current preview mode globally
    setMode(darkMode ? 'dark' : 'light');
    const name = DESIGN_SYSTEMS.find(s => s.id === currentSystemId)?.name || currentSystemId;
    toast.success(`"${name}" applied globally (${darkMode ? 'dark' : 'light'} mode).`);
  };

  const handleReset = async () => {
    if (!isCoach) {
      toast.error('Sign in as a coach to reset the theme.');
      return;
    }
    await resetToDefault(teamId!);
    setMode('dark');
    setDarkMode(true);
    setActive('current');
    toast.success('Design system reset to default.');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Top Nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 12px',
        display: 'flex', alignItems: 'center', gap: '12px',
        height: '56px',
      }}>
        <Link to="/" style={{
          color: 'rgba(255,255,255,0.45)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '13px', flexShrink: 0,
        }}>
          <ArrowLeft size={14} /> Back
        </Link>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* System tabs */}
        <div style={{ display: 'flex', gap: '3px', flex: 1, overflowX: 'auto' }}>
          {(Object.keys(THEME_PAIRS) as ThemeKey[]).map(key => {
            const p = THEME_PAIRS[key];
            const isActive = active === key;
            return (
              <button key={key} onClick={() => setActive(key)} style={{
                padding: '5px 12px', borderRadius: '6px', border: 'none',
                background: isActive ? `${p.accent}18` : 'transparent',
                color: isActive ? p.accent : 'rgba(255,255,255,0.38)',
                fontSize: '13px', fontWeight: isActive ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                outline: isActive ? `1px solid ${p.accent}40` : 'none',
              }}>
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={!isCoach}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '6px', flexShrink: 0,
            background: !isCoach ? 'rgba(255,255,255,0.03)' : isApplied ? 'rgba(74,190,122,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${!isCoach ? 'rgba(255,255,255,0.06)' : isApplied ? 'rgba(74,190,122,0.4)' : 'rgba(255,255,255,0.12)'}`,
            color: !isCoach ? 'rgba(255,255,255,0.3)' : isApplied ? '#4abe7a' : 'rgba(255,255,255,0.7)',
            fontSize: '12px', fontWeight: 600, cursor: isCoach ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}
        >
          {!isCoach ? (
            <><Lock size={13} /> Sign in to apply</>
          ) : isApplied ? (
            <><Check size={13} /> Applied</>
          ) : (
            <><Paintbrush size={13} /> Apply</>
          )}
        </button>

        {/* Reset button */}
        {isCoach && activeSystemId !== 'default' && (
          <button
            onClick={handleReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '6px', flexShrink: 0,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}

        {/* Light / Dark toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px', flexShrink: 0,
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: darkMode ? 'rgba(255,255,255,0.6)' : '#ffd60a',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {darkMode ? <Moon size={13} /> : <Sun size={13} />}
          {darkMode ? 'Dark' : 'Light'}
        </button>
      </div>

      <DesignShowcase t={t} />
    </div>
  );
}
