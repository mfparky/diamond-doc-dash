const CELL = 44;

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
      }}
    >
      {cells.map((_, i) => (
        <div
          key={i}
          style={{
            width: CELL,
            height: CELL,
            boxSizing: 'border-box',
            borderRight: (i % 3) < 2 ? '1.5px solid #999' : 'none',
            borderBottom: Math.floor(i / 3) < 2 ? '1.5px solid #999' : 'none',
          }}
        />
      ))}
    </div>
  );
}

const OUTCOMES_TOP = ['K', 'BB', '1B', '2B', '3B', 'HR'];
const OUTCOMES_BOT = ['GO', 'FO', 'LD', 'HBP', 'E'];

const ROW_H = 138;

export function PrintableLiveAbsForm() {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

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
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Hawks 12U AA — Live ABs Chart
          </span>
        </div>

        {/* Header fields: Pitcher + Date only */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 9, fontSize: 9 }}>
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

        {/* Main table — fixed layout, 6 columns */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: 28 }} />   {/* AB */}
            <col style={{ width: 120 }} />  {/* BATTER */}
            <col style={{ width: 148 }} />  {/* ZONE */}
            <col style={{ width: 40 }} />   {/* PC */}
            <col style={{ width: 130 }} />  {/* OUTCOME */}
            <col />                          {/* NOTES — fills remaining */}
          </colgroup>

          <thead>
            <tr style={{ borderBottom: '2px solid #000' }}>
              {['AB', 'BATTER', 'ZONE', 'PC', 'OUTCOME', 'NOTES'].map((label) => (
                <th
                  key={label}
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
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 5 }, (_, i) => {
              const rowNum = i + 1;
              const rowBg = rowNum % 2 !== 0 ? '#fafafa' : '#fff';

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
                      fontSize: 10,
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

                  {/* BATTER */}
                  <td
                    style={{
                      verticalAlign: 'bottom',
                      borderRight: '1px solid #ccc',
                      padding: '0 6px 6px',
                    }}
                  >
                    <div style={{ borderBottom: '1px solid #999', height: 22, width: '100%' }} />
                  </td>

                  {/* ZONE */}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      borderRight: '1px solid #ccc',
                      padding: '4px',
                    }}
                  >
                    <StrikeZone />
                  </td>

                  {/* PC */}
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
                        height: 50,
                        width: 32,
                        margin: '0 auto',
                        boxSizing: 'border-box',
                      }}
                    />
                  </td>

                  {/* OUTCOME — two rows of circle-labels */}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      borderRight: '1px solid #ccc',
                      padding: '4px 6px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {OUTCOMES_TOP.map((label) => (
                          <span
                            key={label}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              borderBottom: '1.5px solid #bbb',
                              paddingBottom: 1,
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3,
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {OUTCOMES_BOT.map((label) => (
                          <span
                            key={label}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              borderBottom: '1.5px solid #bbb',
                              paddingBottom: 1,
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3,
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* NOTES */}
                  <td
                    style={{
                      verticalAlign: 'bottom',
                      padding: '0 6px 6px',
                    }}
                  >
                    <div style={{ borderBottom: '1px solid #999', height: 22, width: '100%', marginBottom: 28 }} />
                    <div style={{ borderBottom: '1px solid #999', height: 22, width: '100%' }} />
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
