import { PitchTypeConfig } from '@/types/pitch-location';

interface PrintableFormProps {
  pitchTypes: PitchTypeConfig; // e.g. { "1": "FB", "2": "CB", "3": "CH" }
}

// Cell coordinate mapping for scan prompt awareness
// Label used on the form must match STRUCTURED_FORM_CELLS in scan-form.ts
interface CellDef {
  label: string;      // printed on form + read by AI
  sublabel: string;   // human-friendly location
  isZone: boolean;
}

const ZONE_CELLS: CellDef[][] = [
  [
    { label: 'HI-L',  sublabel: 'Above Left',  isZone: false },
    { label: 'HI-C',  sublabel: 'Above Center', isZone: false },
    { label: 'HI-R',  sublabel: 'Above Right',  isZone: false },
  ],
  [
    { label: 'TL', sublabel: 'Top Left',    isZone: true },
    { label: 'TC', sublabel: 'Top Center',  isZone: true },
    { label: 'TR', sublabel: 'Top Right',   isZone: true },
  ],
  [
    { label: 'ML', sublabel: 'Mid Left',    isZone: true },
    { label: 'MC', sublabel: 'Mid Center',  isZone: true },
    { label: 'MR', sublabel: 'Mid Right',   isZone: true },
  ],
  [
    { label: 'BL', sublabel: 'Bot Left',    isZone: true },
    { label: 'BC', sublabel: 'Bot Center',  isZone: true },
    { label: 'BR', sublabel: 'Bot Right',   isZone: true },
  ],
  [
    { label: 'LO-L',  sublabel: 'Below Left',   isZone: false },
    { label: 'LO-C',  sublabel: 'Below Center',  isZone: false },
    { label: 'LO-R',  sublabel: 'Below Right',   isZone: false },
  ],
];

const LEFT_CELLS: CellDef[] = [
  { label: 'L-HI',  sublabel: 'Left High', isZone: false },
  { label: 'L-MID', sublabel: 'Left Mid',  isZone: false },
  { label: 'L-LO',  sublabel: 'Left Low',  isZone: false },
];

const RIGHT_CELLS: CellDef[] = [
  { label: 'R-HI',  sublabel: 'Right High', isZone: false },
  { label: 'R-MID', sublabel: 'Right Mid',  isZone: false },
  { label: 'R-LO',  sublabel: 'Right Low',  isZone: false },
];

function TallyCell({
  cell,
  pitchTypes,
  wide = false,
}: {
  cell: CellDef;
  pitchTypes: PitchTypeConfig;
  wide?: boolean;
}) {
  const ptEntries = Object.entries(pitchTypes).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <td
      style={{
        border: cell.isZone ? '2px solid #000' : '1px dashed #888',
        padding: '4px 6px',
        verticalAlign: 'top',
        width: wide ? '16%' : '13%',
        minWidth: wide ? 80 : 60,
        backgroundColor: cell.isZone ? '#fff' : '#f8f8f8',
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: '#000', marginBottom: 2 }}>
        {cell.label}
      </div>
      {ptEntries.map(([key, name]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 8, lineHeight: '14px' }}>
          <span style={{ fontWeight: 600, minWidth: 22, color: '#333' }}>{key} {name}:</span>
          <span style={{ borderBottom: '1px solid #000', flex: 1, minWidth: 20 }}>&nbsp;</span>
        </div>
      ))}
    </td>
  );
}

function EmptyCell() {
  return <td style={{ border: 'none', backgroundColor: 'transparent' }} />;
}

export function PrintableForm({ pitchTypes }: PrintableFormProps) {
  const ptEntries = Object.entries(pitchTypes).sort(([a], [b]) => Number(a) - Number(b));
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  // Build 5×5 table: rows = [HI, zone-top, zone-mid, zone-bot, LO]
  //                  cols = [LEFT, zone-L, zone-C, zone-R, RIGHT]
  const rows = ZONE_CELLS; // 5 rows of 3 zone/above/below cells each

  return (
    <div
      id="printable-form"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        backgroundColor: '#fff',
        color: '#000',
        padding: '20px 24px',
        maxWidth: 720,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Diamond Doc — Pitch Chart
        </div>
        <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
          Structured form — write pitch COUNT per region (not individual pitches)
        </div>
      </div>

      {/* Header fields */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ fontSize: 9, paddingRight: 8, whiteSpace: 'nowrap' }}>Name:</td>
            <td style={{ borderBottom: '1px solid #000', width: '30%' }}>&nbsp;</td>
            <td style={{ fontSize: 9, paddingLeft: 12, paddingRight: 8, whiteSpace: 'nowrap' }}>Date:</td>
            <td style={{ borderBottom: '1px solid #000', width: '15%' }}>
              <span style={{ fontSize: 8, color: '#888' }}>{today}</span>
            </td>
            <td style={{ fontSize: 9, paddingLeft: 12, paddingRight: 8, whiteSpace: 'nowrap' }}>Session:</td>
            <td style={{ borderBottom: '1px solid #000', width: '20%' }}>&nbsp;</td>
          </tr>
          <tr style={{ height: 8 }} />
          <tr>
            <td style={{ fontSize: 9, paddingRight: 8, whiteSpace: 'nowrap' }}>Pitches:</td>
            <td style={{ borderBottom: '1px solid #000', width: '10%' }}>&nbsp;</td>
            <td style={{ fontSize: 9, paddingLeft: 12, paddingRight: 8, whiteSpace: 'nowrap' }}>Strikes:</td>
            <td style={{ borderBottom: '1px solid #000', width: '10%' }}>&nbsp;</td>
            <td style={{ fontSize: 9, paddingLeft: 12, paddingRight: 8, whiteSpace: 'nowrap' }}>Max Velo:</td>
            <td style={{ borderBottom: '1px solid #000', width: '10%' }}>&nbsp;</td>
          </tr>
          <tr style={{ height: 8 }} />
          <tr>
            <td style={{ fontSize: 9, paddingRight: 8, whiteSpace: 'nowrap' }}>Focus:</td>
            <td colSpan={5} style={{ borderBottom: '1px solid #000' }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
        Pitch Locations
      </div>
      <div style={{ fontSize: 8, color: '#555', marginBottom: 6 }}>
        Write the <strong>count</strong> of pitches of each type thrown to each region.
        Dashed border = ball. Solid border = strike zone.
      </div>

      {/* Pitch type legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {ptEntries.map(([key, name]) => (
          <span key={key} style={{ fontSize: 9, fontWeight: 600 }}>
            {key} = {name}
          </span>
        ))}
      </div>

      {/* Location grid */}
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', marginBottom: 12 }}>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isTopRow = rowIdx === 0;
            const isBottomRow = rowIdx === 4;
            const zoneRowIdx = rowIdx - 1; // 0-2 for zone rows, -1 for top, 3 for bottom

            return (
              <tr key={rowIdx} style={{ height: isTopRow || isBottomRow ? 'auto' : 'auto' }}>
                {/* Left ball column */}
                {isTopRow || isBottomRow ? (
                  <EmptyCell />
                ) : (
                  <TallyCell cell={LEFT_CELLS[zoneRowIdx]} pitchTypes={pitchTypes} />
                )}

                {/* Zone / above / below cells */}
                {row.map((cell) => (
                  <TallyCell key={cell.label} cell={cell} pitchTypes={pitchTypes} wide />
                ))}

                {/* Right ball column */}
                {isTopRow || isBottomRow ? (
                  <EmptyCell />
                ) : (
                  <TallyCell cell={RIGHT_CELLS[zoneRowIdx]} pitchTypes={pitchTypes} />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sequence strip */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
          Pitch Sequence <span style={{ fontWeight: 400, fontSize: 8 }}>(optional — write pitch type # in order)</span>
        </div>
        {/* Two rows of 15 boxes each */}
        {[0, 15].map((offset) => (
          <div key={offset} style={{ display: 'flex', gap: 2, marginBottom: 4, alignItems: 'flex-end' }}>
            {Array.from({ length: 15 }, (_, i) => i + offset + 1).map((n) => (
              <div key={n} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ border: '1px solid #000', height: 18, width: '100%', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 6, color: '#888', marginTop: 1 }}>{n}</div>
              </div>
            ))}
          </div>
        ))}
        {/* B/S row */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 8, marginRight: 4, whiteSpace: 'nowrap', fontWeight: 600 }}>B/S:</span>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ flex: 1, borderBottom: '1px solid #000', height: 14, marginRight: 2 }} />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
          Notes / Post-Bullpen Reflection
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ borderBottom: '1px solid #ccc', height: 22, marginBottom: 4 }} />
        ))}
      </div>
    </div>
  );
}
