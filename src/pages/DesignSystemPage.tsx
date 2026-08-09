import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Users, BarChart3, TrendingUp, Target, Gauge, Calendar, Share2, Check, X, Sun, Moon, Paintbrush, Lock, Upload } from 'lucide-react';
import { useDesignSystem } from '@/contexts/DesignSystemContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractDominantColorFromImage } from '@/lib/logo-color-extraction';
import { isValidHexColor, normalizeHex } from '@/lib/color-utils';

// ─── Theme Definition ─────────────────────────────────────────────────────────
//
// One brand identity: Athlete. Previously this page showcased 9 selectable
// themes with their own definitions duplicated (and drifted) from
// DesignSystemContext's canonical DESIGN_SYSTEMS list. Simplified to just
// this one — colors match DESIGN_SYSTEMS' 'athlete' entry, with additional
// typography/shape metadata this showcase page uses that the context's
// simpler ThemeVariant shape doesn't carry.

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

type Theme = typeof ATHLETE;

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

export default function DesignSystemPage() {
  const { activeSystemId, mode, setMode, setSystem, setAccentColor } = useDesignSystem();
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  // Team's saved brand color plus any unsaved pick — null means "use Athlete's stock volt green".
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [pickedColor, setPickedColor] = useState<string | null>(null);

  // Local preview mode (synced with global mode initially)
  const [darkMode, setDarkMode] = useState(mode === 'dark');
  const t = darkMode ? ATHLETE : ATHLETE_LIGHT;

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

  // Fetch the team's current logo + brand color for display once teamId resolves
  useEffect(() => {
    if (!teamId) return;
    supabase.rpc('get_public_team_info', { p_team_id: teamId }).then(({ data }) => {
      const team = data?.[0] as { logo_url?: string | null; brand_color?: string | null } | undefined;
      setLogoUrl(team?.logo_url ?? null);
      setBrandColor(team?.brand_color ?? null);
      setPickedColor(team?.brand_color ?? null);
    });
  }, [teamId]);

  const isCoach = !!user && !!teamId;

  const handleLogoUpload = async (file: File) => {
    if (!teamId) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${teamId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('team-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('team-logos').getPublicUrl(path);
      // Cache-bust so the new logo shows immediately instead of a stale cached image.
      const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('teams')
        .update({ logo_url: bustedUrl })
        .eq('id', teamId);
      if (updateError) throw updateError;

      setLogoUrl(bustedUrl);
      toast.success('Team logo updated.');

      const suggested = await extractDominantColorFromImage(file);
      if (suggested) {
        setPickedColor(suggested);
        toast.info('Suggested a brand color from your logo — adjust it if needed, then Apply.');
      }
    } catch (err) {
      toast.error('Could not upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const isApplied = activeSystemId === 'athlete';

  const handleApply = async () => {
    if (!isCoach) {
      toast.error('Sign in as a coach to change the global theme.');
      return;
    }
    await setSystem('athlete', teamId!);
    // Also apply the current preview mode + brand color globally
    setMode(darkMode ? 'dark' : 'light');
    const colorToSave = pickedColor && isValidHexColor(pickedColor) ? normalizeHex(pickedColor) : null;
    await setAccentColor(colorToSave, teamId!);
    setBrandColor(colorToSave);
    toast.success(`Athlete applied globally (${darkMode ? 'dark' : 'light'} mode).`);
  };

  const handleResetColor = async () => {
    if (!isCoach) return;
    setPickedColor(null);
    setBrandColor(null);
    await setAccentColor(null, teamId!);
    toast.success('Reverted to Athlete’s default volt green.');
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

        <div style={{ flex: 1 }} />

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

        {isCoach && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '6px', flexShrink: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px', fontWeight: 600,
                cursor: uploadingLogo ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {logoUrl && (
                <img src={logoUrl} alt="" style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 3 }} />
              )}
              <Upload size={13} />
              {uploadingLogo ? 'Uploading…' : 'Team logo'}
            </button>

            <label
              title="Team brand color"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '6px', flexShrink: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                cursor: 'pointer',
              }}
            >
              <input
                type="color"
                value={pickedColor && isValidHexColor(pickedColor) ? normalizeHex(pickedColor) : '#c6f135'}
                onChange={(e) => setPickedColor(e.target.value)}
                style={{
                  width: 20, height: 20, padding: 0, border: 'none',
                  borderRadius: '4px', background: 'none', cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                Brand color
              </span>
            </label>

            {(brandColor || pickedColor) && (
              <button
                onClick={handleResetColor}
                style={{
                  padding: '6px 10px', borderRadius: '6px', flexShrink: 0,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Use default
              </button>
            )}
          </>
        )}
      </div>

      <DesignShowcase t={t} />
    </div>
  );
}
