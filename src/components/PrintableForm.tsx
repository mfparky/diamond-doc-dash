import { PitchTypeConfig } from '@/types/pitch-location';

interface PrintableFormProps {
  pitchTypes: PitchTypeConfig;
}

const ZONE_LABELS = [
  ['TL', 'TC', 'TR'],
  ['ML', 'MC', 'MR'],
  ['BL', 'BC', 'BR'],
];

const CELL_W = 66;
const CELL_H = 72;
// ~half-cell buffer: enough room to write ball pitch numbers, keeps form on 1 page
const BALL_PAD_H = 38;
const BALL_PAD_V = 40;

function ZonePlot() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 7, color: '#bbb', letterSpacing: 1 }}>
        ← ARM &nbsp;&nbsp;&nbsp; GLOVE →
      </div>

      {/* Outer dashed ball area — full-cell buffer on all sides */}
      <div style={{
        border: '1.5px dashed #999',
        paddingTop: BALL_PAD_V,
        paddingBottom: BALL_PAD_V,
        paddingLeft: BALL_PAD_H,
        paddingRight: BALL_PAD_H,
        backgroundColor: '#fafafa',
        display: 'inline-flex',
      }}>
        {/* Inner strike zone 3×3 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(3, ${CELL_W}px)`,
          gridTemplateRows: `repeat(3, ${CELL_H}px)`,
        }}>
          {ZONE_LABELS.flat().map((label) => (
            <div
              key={label}
              style={{
                border: '2px solid #000',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                padding: '2px 3px',
                boxSizing: 'border-box',
                margin: -1,
              }}
            >
              <span style={{ fontSize: 6, color: '#ccc', lineHeight: 1 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 7, color: '#aaa' }}>
        Write pitch # in zone or ball area
      </div>
    </div>
  );
}

// 4-column pitch list — 13 rows each (pitches 1-13, 14-26, 27-39, 40-52 → capped at 50)
const COL_SIZE = 13;
const COL_STARTS = [1, 14, 27, 40];

function PitchList() {
  const col = (start: number) => (
    <table style={{ borderCollapse: 'collapse', flex: 1 }}>
      <thead>
        <tr style={{ borderBottom: '1.5px solid #000' }}>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'center', paddingBottom: 2, width: 16 }}>#</th>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'left',   paddingBottom: 2, paddingLeft: 3, width: 32 }}>Type</th>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'center', paddingBottom: 2, width: 18 }}>Out</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: COL_SIZE }, (_, i) => start + i).map((n) => (
          <tr key={n} style={{ height: 15 }}>
            <td style={{ fontSize: 7, textAlign: 'center', color: '#888', borderBottom: '0.5px solid #e0e0e0', verticalAlign: 'bottom', paddingBottom: 1 }}>{n}</td>
            <td style={{ borderBottom: '0.5px solid #e0e0e0', paddingLeft: 3 }}>&nbsp;</td>
            <td style={{ borderBottom: '0.5px solid #e0e0e0' }}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {COL_STARTS.map((start, i) => (
        <>
          {i > 0 && <div key={`div-${i}`} style={{ width: 1, backgroundColor: '#ddd', alignSelf: 'stretch' }} />}
          <div key={start} style={{ flex: 1 }}>{col(start)}</div>
        </>
      ))}
    </div>
  );
}

export function PrintableForm({ pitchTypes }: PrintableFormProps) {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const ptEntries = Object.entries(pitchTypes).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <>
      {/* Print-only page setup — forces letter portrait with tight margins */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.3in 0.4in;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          #printable-form {
            max-width: 100% !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div
        id="printable-form"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          backgroundColor: '#fff',
          color: '#000',
          padding: '12px 16px',
          maxWidth: 680,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Diamond Doc — Pitch Chart
          </span>
        </div>

        {/* Header fields */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: 9 }}>
          <tbody>
            <tr>
              <td style={{ whiteSpace: 'nowrap', paddingRight: 6 }}>Name:</td>
              <td style={{ borderBottom: '1px solid #000', width: '26%' }}>&nbsp;</td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 6 }}>Date:</td>
              <td style={{ borderBottom: '1px solid #000', width: '12%' }}>
                <span style={{ fontSize: 7, color: '#aaa' }}>{today}</span>
              </td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 6 }}>Session:</td>
              <td style={{ borderBottom: '1px solid #000', width: '18%' }}>&nbsp;</td>
            </tr>
          </tbody>
        </table>

        {/* Top section: zone plot (left) + notes/legend (right) */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 8 }}>

          {/* Zone plot */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
              Pitch Location
            </div>
            <ZonePlot />
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, backgroundColor: '#ddd', alignSelf: 'stretch' }} />

          {/* Right: pitch type legend + outcome key + notes lines */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Pitch types */}
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                Pitch Types
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                {ptEntries.map(([key, name]) => (
                  <div key={key} style={{ fontSize: 8 }}>
                    <strong>{key}</strong> = {name}
                  </div>
                ))}
              </div>
            </div>

            {/* Outcome key */}
            <div style={{ fontSize: 8, color: '#444', borderTop: '1px solid #eee', paddingTop: 6 }}>
              <strong>Out:</strong>&nbsp; S = Strike &nbsp; B = Ball &nbsp; W = Wild Pitch
            </div>

            {/* Focus */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 9 }}>
              <span style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Focus:</span>
              <div style={{ flex: 1, borderBottom: '1px solid #000', height: 16 }} />
            </div>

            {/* Notes */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                Notes
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ borderBottom: '1px solid #ccc', height: 22, marginBottom: 4 }} />
              ))}
            </div>

            {/* Pitches total */}
            <div style={{ display: 'flex', gap: 16, fontSize: 9, borderTop: '1px solid #eee', paddingTop: 6 }}>
              <span>Total pitches: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: 28 }}>&nbsp;</span></span>
              <span>Strikes: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: 28 }}>&nbsp;</span></span>
              <span>Max velo: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: 28 }}>&nbsp;</span></span>
            </div>
          </div>
        </div>

        {/* Horizontal divider */}
        <div style={{ borderTop: '1px solid #ccc', marginBottom: 8 }} />

        {/* Pitch log — 3 columns */}
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
            Pitch Log
          </div>
          <PitchList />
        </div>
      </div>
    </>
  );
}
