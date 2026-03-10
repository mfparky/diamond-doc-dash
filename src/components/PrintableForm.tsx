import { PitchTypeConfig } from '@/types/pitch-location';

interface PrintableFormProps {
  pitchTypes: PitchTypeConfig; // e.g. { "1": "FB", "2": "CB", "3": "CH" }
}

// 9 zone cells for the plot — labels printed lightly for AI scanning
const ZONE_LABELS = [
  ['TL', 'TC', 'TR'],
  ['ML', 'MC', 'MR'],
  ['BL', 'BC', 'BR'],
];

function ZonePlot() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
      <div style={{ fontSize: 7, color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' }}>
        ← ARM SIDE &nbsp;&nbsp;&nbsp; GLOVE SIDE →
      </div>

      {/* Outer ball area */}
      <div style={{
        border: '1.5px dashed #aaa',
        padding: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        position: 'relative',
      }}>
        {/* Inner strike zone */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 52px)', gridTemplateRows: 'repeat(3, 62px)' }}>
          {ZONE_LABELS.flat().map((label) => (
            <div
              key={label}
              style={{
                border: '2px solid #000',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                padding: '1px 3px',
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
        Write pitch # in the zone or ball area
      </div>
    </div>
  );
}

function PitchList({ pitchTypes }: { pitchTypes: PitchTypeConfig }) {
  // Two columns: 1–25 on left, 26–50 on right
  const COL_SIZE = 25;

  const col = (start: number) => (
    <table style={{ borderCollapse: 'collapse', flex: 1 }}>
      <thead>
        <tr>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: 2, width: 18 }}>#</th>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'left',   borderBottom: '1.5px solid #000', paddingBottom: 2, width: 36, paddingLeft: 3 }}>Type</th>
          <th style={{ fontSize: 7, fontWeight: 700, textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: 2, width: 22 }}>Out</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: COL_SIZE }, (_, i) => start + i).map((n) => (
          <tr key={n} style={{ height: 16 }}>
            <td style={{ fontSize: 7, textAlign: 'center', color: '#666', borderBottom: '0.5px solid #e0e0e0', verticalAlign: 'bottom', paddingBottom: 1 }}>{n}</td>
            <td style={{ borderBottom: '0.5px solid #e0e0e0', paddingLeft: 3 }}>&nbsp;</td>
            <td style={{ borderBottom: '0.5px solid #e0e0e0' }}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const ptEntries = Object.entries(pitchTypes).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: 7, fontWeight: 700 }}>Types:</span>
        {ptEntries.map(([key, name]) => (
          <span key={key} style={{ fontSize: 7 }}>{key}={name}</span>
        ))}
        <span style={{ fontSize: 7, color: '#555', marginLeft: 6 }}>Out: S B W</span>
      </div>

      {/* Two-column pitch rows */}
      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
        {col(1)}
        <div style={{ width: 1, backgroundColor: '#ddd' }} />
        {col(26)}
      </div>

      {/* Key */}
      <div style={{ fontSize: 7, color: '#777', marginTop: 2 }}>
        S = Strike &nbsp; B = Ball &nbsp; W = Wild Pitch (ball, far outside)
      </div>
    </div>
  );
}

export function PrintableForm({ pitchTypes }: PrintableFormProps) {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  return (
    <div
      id="printable-form"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        backgroundColor: '#fff',
        color: '#000',
        padding: '16px 20px',
        maxWidth: 680,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Diamond Doc — Pitch Chart
        </span>
      </div>

      {/* Header fields */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 9 }}>
        <tbody>
          <tr>
            <td style={{ whiteSpace: 'nowrap', paddingRight: 6 }}>Name:</td>
            <td style={{ borderBottom: '1px solid #000', width: '28%' }}>&nbsp;</td>
            <td style={{ whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 6 }}>Date:</td>
            <td style={{ borderBottom: '1px solid #000', width: '13%' }}>
              <span style={{ fontSize: 7, color: '#aaa' }}>{today}</span>
            </td>
            <td style={{ whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 6 }}>Session:</td>
            <td style={{ borderBottom: '1px solid #000', width: '20%' }}>&nbsp;</td>
          </tr>
          <tr style={{ height: 6 }} />
          <tr>
            <td style={{ whiteSpace: 'nowrap', paddingRight: 6 }}>Focus:</td>
            <td colSpan={3} style={{ borderBottom: '1px solid #000' }}>&nbsp;</td>
            <td style={{ whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 6 }}>Pitches:</td>
            <td style={{ borderBottom: '1px solid #000' }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* Body: zone plot + pitch list */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 10 }}>
        {/* Left: zone plot */}
        <div style={{ flexShrink: 0, width: 200 }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
            Pitch Location
          </div>
          <ZonePlot />
        </div>

        {/* Divider */}
        <div style={{ width: 1, backgroundColor: '#ddd', alignSelf: 'stretch' }} />

        {/* Right: pitch list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
            Pitch Log
          </div>
          <PitchList pitchTypes={pitchTypes} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, letterSpacing: 0.5 }}>
          Notes
        </div>
        {[0, 1].map((i) => (
          <div key={i} style={{ borderBottom: '1px solid #ccc', height: 20, marginBottom: 4 }} />
        ))}
      </div>
    </div>
  );
}
