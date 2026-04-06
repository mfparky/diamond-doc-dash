import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, BarChart3, TrendingUp, Target, Gauge, Calendar, Share2, Check, X } from 'lucide-react';

// ─── Theme Definitions ────────────────────────────────────────────────────────

const LINEAR = {
  name: 'Linear',
  tagline: 'Precision engineering aesthetic — dark-first, indigo accent',
  font: `'Inter', -apple-system, system-ui, sans-serif`,

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
  accentHover: '#828fff',

  statusGreen: '#27a644',
  statusGreenBg: 'rgba(39,166,68,0.12)',
  statusYellow: '#f59e0b',
  statusYellowBg: 'rgba(245,158,11,0.12)',
  statusRed: '#ef4444',
  statusRedBg: 'rgba(239,68,68,0.12)',

  radius: '6px',
  radiusSm: '4px',
  radiusLg: '10px',
  shadow: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.4)',
};

const SPOTIFY = {
  name: 'Spotify',
  tagline: 'Immersive dark, vibrant green, pill-shaped — touch-optimized',
  font: `'CircularSp', 'Helvetica Neue', Helvetica, Arial, sans-serif`,

  bg: '#121212',
  surface: '#181818',
  surfaceElevated: '#252525',
  border: '#282828',
  borderSolid: '#3e3e3e',

  textPrimary: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#727272',
  textSubtle: '#535353',

  accent: '#1ed760',
  accentBg: '#1ed760',
  accentHover: '#1fdf64',

  statusGreen: '#1ed760',
  statusGreenBg: 'rgba(30,215,96,0.15)',
  statusYellow: '#ffa42b',
  statusYellowBg: 'rgba(255,164,43,0.15)',
  statusRed: '#f3727f',
  statusRedBg: 'rgba(243,114,127,0.15)',

  radius: '9999px',
  radiusSm: '9999px',
  radiusLg: '9999px',
  shadow: 'rgba(0,0,0,0.5) 0px 8px 24px',
};

const UBER = {
  name: 'Uber',
  tagline: 'Pure black & white, zero mid-tones, billboard typography — maximum sunlight contrast',
  font: `'UberMove', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif`,

  bg: '#ffffff',
  surface: '#f6f6f6',
  surfaceElevated: '#eeeeee',
  border: '#e2e2e2',
  borderSolid: '#d0d0d0',

  textPrimary: '#000000',
  textSecondary: '#4b4b4b',
  textMuted: '#767676',
  textSubtle: '#afafaf',

  accent: '#000000',
  accentBg: '#000000',
  accentHover: '#333333',

  statusGreen: '#00752f',
  statusGreenBg: '#e6f5ec',
  statusYellow: '#8c5a00',
  statusYellowBg: '#fef5e0',
  statusRed: '#c0392b',
  statusRedBg: '#fde8e6',

  radius: '999px',
  radiusSm: '4px',
  radiusLg: '999px',
  shadow: 'rgba(0,0,0,0.12) 0px 4px 16px',
};

type Theme = typeof LINEAR;

// ─── Shared Showcase Components ───────────────────────────────────────────────

function Section({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <h3 style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
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
    { label: 'Background', color: t.bg, text: t.textPrimary },
    { label: 'Surface', color: t.surface, text: t.textPrimary },
    { label: 'Elevated', color: t.surfaceElevated, text: t.textPrimary },
    { label: 'Accent', color: t.accentBg, text: t.name === 'Uber' ? '#ffffff' : '#000000' },
    { label: 'Green', color: t.statusGreen, text: '#ffffff' },
    { label: 'Yellow', color: t.statusYellow, text: '#ffffff' },
    { label: 'Red', color: t.statusRed, text: '#ffffff' },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {swatches.map(s => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{
            width: '72px',
            height: '48px',
            background: s.color,
            borderRadius: t.radiusSm,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'flex-end',
            padding: '4px',
          }} />
          <span style={{ fontSize: '10px', color: t.textMuted, textAlign: 'center' }}>{s.label}</span>
          <span style={{ fontSize: '9px', color: t.textSubtle, textAlign: 'center', fontFamily: 'monospace' }}>{s.color}</span>
        </div>
      ))}
    </div>
  );
}

function TypographyScale({ t }: { t: Theme }) {
  const levels = [
    { label: 'Display', size: '36px', weight: t.name === 'Uber' ? 700 : 600, letterSpacing: t.name === 'Linear' ? '-0.8px' : 'normal' },
    { label: 'Heading', size: '24px', weight: t.name === 'Uber' ? 700 : 600, letterSpacing: t.name === 'Linear' ? '-0.4px' : 'normal' },
    { label: 'Subheading', size: '18px', weight: t.name === 'Spotify' ? 600 : 500, letterSpacing: 'normal' },
    { label: 'Body', size: '15px', weight: 400, letterSpacing: 'normal' },
    { label: 'Caption', size: '12px', weight: 400, letterSpacing: t.name === 'Spotify' ? '0.08em' : 'normal' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {levels.map(l => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <span style={{ fontSize: '10px', color: t.textMuted, width: '80px', flexShrink: 0 }}>{l.label}</span>
          <span style={{
            fontSize: l.size,
            fontWeight: l.weight,
            color: t.textPrimary,
            letterSpacing: l.letterSpacing,
            lineHeight: 1.1,
            textTransform: (t.name === 'Spotify' && l.label === 'Caption') ? 'uppercase' : 'none',
          }}>
            Pitch Tracker
          </span>
        </div>
      ))}
    </div>
  );
}

function ButtonSet({ t }: { t: Theme }) {
  const baseBtn = {
    padding: t.name === 'Spotify' ? '14px 28px' : '10px 20px',
    borderRadius: t.radius,
    fontFamily: t.font,
    fontSize: '14px',
    fontWeight: t.name === 'Uber' ? 500 : 600,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: t.name === 'Spotify' ? '1.6px' : 'normal',
    textTransform: (t.name === 'Spotify' ? 'uppercase' : 'none') as React.CSSProperties['textTransform'],
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  };

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Primary */}
      <button style={{ ...baseBtn, background: t.accentBg, color: t.name === 'Uber' ? '#ffffff' : (t.name === 'Spotify' ? '#000000' : '#ffffff') }}>
        <Plus size={14} /> Log Outing
      </button>

      {/* Secondary */}
      <button style={{
        ...baseBtn,
        background: 'transparent',
        color: t.textSecondary,
        border: `1px solid ${t.border}`,
      }}>
        View Stats
      </button>

      {/* Ghost */}
      <button style={{
        ...baseBtn,
        background: 'transparent',
        color: t.accent,
        border: 'none',
        padding: '10px 12px',
      }}>
        Cancel
      </button>

      {/* Destructive */}
      <button style={{
        ...baseBtn,
        background: t.statusRedBg,
        color: t.statusRed,
        border: `1px solid ${t.statusRed}20`,
      }}>
        <X size={14} /> Remove
      </button>
    </div>
  );
}

function StatusBadges({ t }: { t: Theme }) {
  const statuses = [
    { label: 'Ready', color: t.statusGreen, bg: t.statusGreenBg },
    { label: 'Caution', color: t.statusYellow, bg: t.statusYellowBg },
    { label: 'Rest', color: t.statusRed, bg: t.statusRedBg },
  ];

  const pill = {
    padding: '5px 12px',
    borderRadius: t.radius,
    fontSize: '12px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    letterSpacing: t.name === 'Spotify' ? '0.06em' : 'normal',
    textTransform: (t.name === 'Spotify' ? 'uppercase' : 'none') as React.CSSProperties['textTransform'],
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {statuses.map(s => (
        <div key={s.label} style={{ ...pill, background: s.bg, color: s.color }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
          {s.label}
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
      borderRadius: t.radiusLg,
      padding: '16px',
      maxWidth: '320px',
      boxShadow: t.shadow,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: t.textPrimary, margin: 0, letterSpacing: t.name === 'Linear' ? '-0.3px' : 'normal' }}>
            Jake Martinez
          </p>
          <div style={{ marginTop: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: t.radius,
              background: t.statusGreenBg,
              color: t.statusGreen,
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
          borderRadius: t.radiusSm,
        }}>
          <Share2 size={16} />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[
          { icon: <TrendingUp size={14} />, label: '7-Day Pulse', value: '42', color: t.accent },
          { icon: <Target size={14} />, label: 'Strike %', value: '64%', color: t.statusGreen },
          { icon: <Gauge size={14} />, label: 'Max Velo', value: '82 mph', color: t.textSecondary },
          { icon: <Calendar size={14} />, label: 'Last Outing', value: 'Apr 3', color: t.textSecondary },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              padding: '6px',
              borderRadius: t.radiusSm,
              background: `${t.accent}18`,
              color: stat.color,
              display: 'flex',
            }}>
              {stat.icon}
            </div>
            <div>
              <p style={{ fontSize: '10px', color: t.textMuted, margin: 0 }}>{stat.label}</p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: t.textPrimary, margin: 0 }}>{stat.value}</p>
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
    padding: t.name === 'Spotify' ? '14px 18px' : '10px 14px',
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: t.name === 'Spotify' ? '8px' : t.radiusSm,
    color: t.textPrimary,
    fontSize: '15px',
    fontFamily: t.font,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: t.textMuted,
    marginBottom: '6px',
    display: 'block',
    letterSpacing: t.name === 'Spotify' ? '0.08em' : 'normal',
    textTransform: t.name === 'Spotify' ? 'uppercase' : 'none',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: t.radiusLg,
      padding: '20px',
      maxWidth: '360px',
      boxShadow: t.shadow,
    }}>
      <p style={{
        fontSize: '18px',
        fontWeight: 700,
        color: t.textPrimary,
        margin: '0 0 20px 0',
        letterSpacing: t.name === 'Linear' ? '-0.3px' : 'normal',
      }}>
        Log Outing
      </p>

      {/* Pitcher Select */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Pitcher</label>
        <select style={{ ...inputStyle, appearance: 'none' }}>
          <option>Jake Martinez</option>
          <option>Cole Davis</option>
          <option>Ethan Brooks</option>
        </select>
      </div>

      {/* Event Type */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Event Type</label>
        <select style={{ ...inputStyle, appearance: 'none' }}>
          <option>Game</option>
          <option>Practice</option>
          <option>Bullpen</option>
        </select>
      </div>

      {/* Pitch Count + Strikes — row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Pitch Count</label>
          <input type="number" placeholder="72" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Strikes</label>
          <input type="number" placeholder="48" style={inputStyle} />
        </div>
      </div>

      {/* Max Velo */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Max Velo (mph)</label>
        <input type="number" placeholder="84" style={inputStyle} />
      </div>

      {/* Notes */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Notes</label>
        <textarea
          placeholder="Good fastball command today..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{
          flex: 1,
          padding: t.name === 'Spotify' ? '14px' : '12px',
          borderRadius: t.radius,
          background: t.accentBg,
          color: t.name === 'Uber' ? '#ffffff' : (t.name === 'Spotify' ? '#000000' : '#ffffff'),
          fontWeight: 700,
          fontSize: '15px',
          border: 'none',
          cursor: 'pointer',
          fontFamily: t.font,
          letterSpacing: t.name === 'Spotify' ? '1.4px' : 'normal',
          textTransform: t.name === 'Spotify' ? 'uppercase' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <Check size={16} /> Save
        </button>
        <button style={{
          padding: t.name === 'Spotify' ? '14px 20px' : '12px 20px',
          borderRadius: t.radius,
          background: 'transparent',
          color: t.textMuted,
          border: `1px solid ${t.border}`,
          fontWeight: 500,
          fontSize: '15px',
          cursor: 'pointer',
          fontFamily: t.font,
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function BottomNavDemo({ t }: { t: Theme }) {
  return (
    <div style={{
      background: t.surface,
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
      {/* Players */}
      <button style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: t.accent,
        fontFamily: t.font,
        padding: '8px 16px',
      }}>
        <Users size={22} />
        <span style={{ fontSize: '11px', fontWeight: 600 }}>Players</span>
      </button>

      {/* Center FAB */}
      <button style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: t.textMuted,
        fontFamily: t.font,
        padding: '4px 16px',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: t.name === 'Uber' ? '50%' : '50%',
          background: t.accentBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.name === 'Uber' ? '#ffffff' : (t.name === 'Spotify' ? '#000000' : '#ffffff'),
          marginTop: '-20px',
          boxShadow: `0 4px 16px ${t.accentBg}60`,
        }}>
          <Plus size={24} />
        </div>
        <span style={{ fontSize: '11px', fontWeight: 500, color: t.textMuted }}>Log</span>
      </button>

      {/* Team */}
      <button style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: t.textMuted,
        fontFamily: t.font,
        padding: '8px 16px',
      }}>
        <BarChart3 size={22} />
        <span style={{ fontSize: '11px', fontWeight: 500 }}>Team</span>
      </button>
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
          padding: '12px 16px',
          background: s.highlight ? `${t.accentBg}18` : t.surface,
          border: `1px solid ${s.highlight ? t.accent + '40' : t.border}`,
          borderRadius: t.radiusLg,
          minWidth: '100px',
        }}>
          <p style={{ fontSize: '10px', color: t.textMuted, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {s.label}
          </p>
          <p style={{
            fontSize: '24px',
            fontWeight: 700,
            color: s.highlight ? t.accent : t.textPrimary,
            margin: 0,
            letterSpacing: t.name === 'Linear' ? '-0.5px' : 'normal',
          }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Showcase ─────────────────────────────────────────────────────────────

function DesignShowcase({ t }: { t: Theme }) {
  return (
    <div style={{
      background: t.bg,
      color: t.textPrimary,
      fontFamily: t.font,
      padding: '32px 24px 64px',
      minHeight: '100vh',
    }}>
      {/* Theme Header */}
      <div style={{
        marginBottom: '40px',
        paddingBottom: '24px',
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: t.radius,
          background: `${t.accentBg}20`,
          border: `1px solid ${t.accent}30`,
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Design System
          </span>
        </div>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 700,
          margin: '0 0 8px',
          color: t.textPrimary,
          letterSpacing: t.name === 'Linear' ? '-0.7px' : (t.name === 'Uber' ? '-0.5px' : 'normal'),
        }}>
          {t.name}
        </h2>
        <p style={{ fontSize: '15px', color: t.textSecondary, margin: 0 }}>{t.tagline}</p>
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

        <Section t={t} title="Status Badges — Arm Health">
          <StatusBadges t={t} />
        </Section>

        <Section t={t} title="Stat Chips — Team Overview">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type ThemeKey = 'linear' | 'spotify' | 'uber';
const THEMES: Record<ThemeKey, Theme> = { linear: LINEAR, spotify: SPOTIFY, uber: UBER };

const TAB_META: Record<ThemeKey, { label: string; accent: string; bg: string }> = {
  linear: { label: 'Linear', accent: '#7170ff', bg: '#0f1011' },
  spotify: { label: 'Spotify', accent: '#1ed760', bg: '#181818' },
  uber: { label: 'Uber', accent: '#000000', bg: '#ffffff' },
};

export default function DesignSystemPage() {
  const [active, setActive] = useState<ThemeKey>('linear');
  const t = THEMES[active];

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Top Nav Bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '56px',
      }}>
        <Link
          to="/"
          style={{
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', flexShrink: 0 }}>
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
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: isActive ? `1px solid ${meta.accent}50` : '1px solid transparent',
                  background: isActive ? `${meta.accent}18` : 'transparent',
                  color: isActive ? meta.accent : 'rgba(255,255,255,0.45)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Design Showcase */}
      <DesignShowcase t={t} />
    </div>
  );
}
