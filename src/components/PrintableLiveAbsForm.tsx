const CELL = 28;

function MiniZone() {
  const cells = Array.from({ length: 9 });
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${CELL}px)`,
        gridTemplateRows: `repeat(3, ${CELL}px)`,
        border: '2px solid #000',
        boxSizing: 'border-box',
      }}
    >
      {cells.map((_, i) => (
        <div
          key={i}
          style={{
            width: CELL,
            height: CELL,
            boxSizing: 'border-box',
            borderRight: (i % 3) < 2 ? '1px solid #aaa' : 'none',
            borderBottom: Math.floor(i / 3) < 2 ? '1px solid #aaa' : 'none',
          }}
        />
      ))}
    </div>
  );
}

const OUTCOMES = ['K', 'BB', '1B', '2B', '3B', 'HR', 'GO', 'FO', 'LD', 'HBP', 'E'];

const COLS = [
  { label: 'AB',      width: 24  },
  { label: 'BATTER',  width: 110 },
  { label: 'ZONE',    width: 96  },
  { label: 'PC',      width: 32  },
  { label: 'OUTCOME', width: 'auto' as const },
  { label: 'NOTES',   width: 130 },
];

const ROW_H = 78;

export function PrintableLiveAbsForm() {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.3in 0.4in;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          #printable-live-abs {
            max-width: 100% !important;
            page-break-inside: avoid;
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
          maxWidth: 980,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '2px solid #000',
            paddingBottom: 5,
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            Diamond Doc — Live ABs Chart
          </span>
        </div>

        {/* Header fields row */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 9,
            fontSize: 9,
          }}
        >
          <tbody>
            <tr>
              <td style={{ whiteSpace: 'nowrap', paddingRight: 5, fontWeight: 700 }}>Pitcher:</td>
              <td style={{ borderBottom: '1px solid #000', width: '28%' }}>
                &nbsp;
              </td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 14, paddingRight: 5, fontWeight: 700 }}>Date:</td>
              <td style={{ borderBottom: '1px solid #000', width: '14%' }}>
                <span style={{ fontSize: 7, color: '#aaa' }}>{today}</span>
              </td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 14, paddingRight: 5, fontWeight: 700 }}>Opponent:</td>
              <td style={{ borderBottom: '1px solid #000', width: '22%' }}>
                &nbsp;
              </td>
              <td style={{ whiteSpace: 'nowrap', paddingLeft: 14, paddingRight: 5, fontWeight: 700 }}>Inning:</td>
              <td style={{ borderBottom: '1px solid #000', width: '10%' }}>
                &nbsp;
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            {COLS.map((c, i) => (
              <col
                key={i}
                style={{ width: c.width === 'auto' ? undefined : c.width }}
              />
            ))}
          </colgroup>

          {/* Header row */}
          <thead>
            <tr style={{ borderBottom: '2px solid #000' }}>
              {COLS.map((c) => (
                <th
                  key={c.label}
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '3px 4px',
                    borderRight: '1px solid #ccc',
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 8 }, (_, i) => {
              const rowNum = i + 1;
              const isOdd = rowNum % 2 !== 0;
              const rowBg = isOdd ? '#fafafa' : '#fff';

              return (
                <tr
                  key={rowNum}
                  style={{
                    height: ROW_H,
                    backgroundColor: rowBg,
                    borderBottom: '1px solid #ddd',
                  }}
                >
                  {/* AB number */}
                  <td
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#888',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      borderRight: '1px solid #ccc',
                      padding: '2px 4px',
                    }}
                  >
                    {rowNum}
                  </td>

                  {/* BATTER — blank write-in line */}
                  <td
                    style={{
                      verticalAlign: 'bottom',
                      borderRight: '1px solid #ccc',
                      padding: '0 4px 4px',
                    }}
                  >
                    <div
                      style={{
                        borderBottom: '1px solid #999',
                        height: 18,
                        width: '100%',
                      }}
                    />
                  </td>

                  {/* ZONE — mini zone grid */}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      borderRight: '1px solid #ccc',
                      padding: '2px 4px',
                    }}
                  >
                    <div style={{ display: 'inline-block' }}>
                      <MiniZone />
                    </div>
                  </td>

                  {/* PC — blank bordered box */}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      borderRight: '1px solid #ccc',
                      padding: '4px',
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #999',
                        height: 48,
                        width: 32,
                        margin: '0 auto',
                        boxSizing: 'border-box',
                      }}
                    />
                  </td>

                  {/* OUTCOME — circle-one labels */}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      borderRight: '1px solid #ccc',
                      padding: '2px 6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-end',
                        flexWrap: 'nowrap',
                      }}
                    >
                      {OUTCOMES.map((label) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            borderBottom: '1px solid #bbb',
                            paddingBottom: 1,
                            whiteSpace: 'nowrap',
                            lineHeight: 1.2,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* NOTES — underline only */}
                  <td
                    style={{
                      verticalAlign: 'bottom',
                      padding: '0 6px 4px',
                    }}
                  >
                    <div
                      style={{
                        borderBottom: '1px solid #999',
                        height: 18,
                        width: '100%',
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
