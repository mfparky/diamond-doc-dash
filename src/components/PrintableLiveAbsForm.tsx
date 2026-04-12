const CELL = 40;
const OUTCOMES_TOP = ['K', 'BB', '1B', '2B', '3B', 'HR'];
const OUTCOMES_BOT = ['GO', 'FO', 'LD', 'HBP', 'E'];

function StrikeZone() {
  const cells = Array.from({ length: 9 });
  return (
    <div
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(3, ${CELL}px)`,
        gridTemplateRows: `repeat(3, ${CELL}px)`,
        border: '2.5px solid #000',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {cells.map((_, i) => (
        <div
          key={i}
          style={{
            width: CELL,
            height: CELL,
            boxSizing: 'border-box',
            borderRight: (i % 3) < 2 ? '1.5px solid #aaa' : 'none',
            borderBottom: Math.floor(i / 3) < 2 ? '1.5px solid #aaa' : 'none',
          }}
        />
      ))}
    </div>
  );
}

function BatterCard({ number }: { number: number }) {
  return (
    <div
      style={{
        border: '1.5px solid #333',
        borderRadius: 3,
        boxSizing: 'border-box',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        backgroundColor: '#fff',
      }}
    >
      {/* AB number + batter name line */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#666',
            lineHeight: 1,
            flexShrink: 0,
            paddingBottom: 2,
          }}
        >
          {number}
        </span>
        <div style={{ flex: 1, borderBottom: '1px solid #888' }} />
      </div>

      {/* Zone + right panel */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Strike zone — dominant left element */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontSize: 7,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#666',
              marginBottom: 3,
              textAlign: 'center',
            }}
          >
            ZONE
          </div>
          <StrikeZone />
        </div>

        {/* Right panel: PC + Outcomes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
          {/* PC */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 7,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: '#555',
                flexShrink: 0,
              }}
            >
              PC
            </span>
            <div
              style={{
                border: '1.5px solid #888',
                width: 40,
                height: 42,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Outcomes */}
          <div>
            <div
              style={{
                fontSize: 7,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: '#555',
                marginBottom: 5,
              }}
            >
              OUTCOME
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 6, flexWrap: 'nowrap' }}>
              {OUTCOMES_TOP.map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    borderBottom: '1.5px solid #bbb',
                    paddingBottom: 1,
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
              {OUTCOMES_BOT.map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    borderBottom: '1.5px solid #bbb',
                    paddingBottom: 1,
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notes — two write-in lines at the bottom */}
      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            fontSize: 7,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: '#555',
            marginBottom: 4,
          }}
        >
          NOTES
        </div>
        <div style={{ borderBottom: '1px solid #bbb', marginBottom: 10, height: 16 }} />
        <div style={{ borderBottom: '1px solid #bbb', height: 16 }} />
      </div>
    </div>
  );
}

export function PrintableLiveAbsForm() {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  return (
    <>
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
          #printable-live-abs {
            max-width: 100% !important;
          }
        }
      `}</style>

      <div
        id="printable-live-abs"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          backgroundColor: '#fff',
          color: '#000',
          padding: '10px 14px',
          maxWidth: 740,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '2px solid #000',
            paddingBottom: 5,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Hawks 12U AA — Live ABs Chart
          </span>
        </div>

        {/* Header: Pitcher + Date */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 10,
            fontSize: 9,
          }}
        >
          <tbody>
            <tr>
              <td style={{ whiteSpace: 'nowrap', paddingRight: 5, fontWeight: 700 }}>Pitcher:</td>
              <td style={{ borderBottom: '1px solid #000', width: '44%' }}>&nbsp;</td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 20, paddingRight: 5, fontWeight: 700 }}>Date:</td>
              <td style={{ borderBottom: '1px solid #000', width: '22%' }}>
                <span style={{ fontSize: 7, color: '#aaa' }}>{today}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2-column, 3-row batter card grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <BatterCard key={i} number={i + 1} />
          ))}
        </div>
      </div>
    </>
  );
}
