import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, BarChart3, TrendingUp, Target, Gauge, Calendar, Share2, Check, X } from 'lucide-react';

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

type ThemeKey = 'linear' | 'apple' | 'stripe' | 'athlete';
const THEMES: Record<ThemeKey, Theme> = { linear: LINEAR, apple: APPLE, stripe: STRIPE, athlete: ATHLETE };

const TAB_META: Record<ThemeKey, { label: string; sublabel: string; accent: string }> = {
  linear:  { label: 'Linear',  sublabel: 'Dark · Indigo',  accent: '#7170ff' },
  apple:   { label: 'Apple',   sublabel: 'Light · Blue',   accent: '#0071e3' },
  stripe:  { label: 'Stripe',  sublabel: 'Light · Purple', accent: '#533afd' },
  athlete: { label: 'Athlete', sublabel: 'Dark · Volt',    accent: '#c6f135' },
};

export default function DesignSystemPage() {
  const [active, setActive] = useState<ThemeKey>('linear');
  const t = THEMES[active];

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Top Nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: '16px',
        height: '56px',
      }}>
        <Link to="/" style={{
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', flexShrink: 0,
        }}>
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', flexShrink: 0, display: 'none' }}>
          Design System Evaluation
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {(Object.keys(TAB_META) as ThemeKey[]).map(key => {
            const meta = TAB_META[key];
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: isActive ? `1px solid ${meta.accent}45` : '1px solid transparent',
                  background: isActive ? `${meta.accent}15` : 'transparent',
                  color: isActive ? meta.accent : 'rgba(255,255,255,0.40)',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  lineHeight: 1.3,
                  gap: '1px',
                }}
              >
                <span>{meta.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.6, fontWeight: 400 }}>{meta.sublabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <DesignShowcase t={t} />
    </div>
  );
}
