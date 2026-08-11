// Shared screen + print stylesheet for the branded report card, used by
// both the single-player editor (ReportCardPage) and the bulk print view
// (PrintAllReportCardsPage) — kept in one place so the two never drift.
export function ReportCardPrintStyles() {
  return (
    <style>{`
      /* On-screen branded header — visible above the metrics + narrative */
      .rc-header {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid hsl(var(--border) / 0.6);
        background: linear-gradient(135deg,
          hsl(var(--background)) 0%,
          hsl(var(--muted) / 0.4) 100%);
      }
      .rc-header-band {
        height: 6px;
        background: linear-gradient(90deg,
          #ef4444 0%,
          #f59e0b 33%,
          #84cc16 66%,
          #10b981 100%);
      }
      .rc-header-inner {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1.25rem 1.5rem;
      }
      .rc-logo {
        height: 64px;
        width: auto;
        flex-shrink: 0;
      }
      .rc-eyebrow {
        font-size: 0.6875rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: hsl(var(--muted-foreground));
        margin: 0 0 0.25rem 0;
        font-weight: 600;
      }
      .rc-player-name {
        font-family: var(--font-display, 'Helvetica Neue', Arial, sans-serif);
        font-size: 1.875rem;
        font-weight: 700;
        margin: 0;
        line-height: 1.1;
        color: hsl(var(--foreground));
      }
      .rc-period {
        font-size: 0.875rem;
        color: hsl(var(--muted-foreground));
        margin: 0.25rem 0 0 0;
      }
      .rc-footer { display: none; }

      @media print {
        /* Landscape letter — each report card fits one page. */
        @page { margin: 0.35in; size: letter landscape; }
        html, body {
          background: white !important;
          color: #111 !important;
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
        }
        nav, aside, .print\\:hidden { display: none !important; }

        /* Keep gradient/color backgrounds when saving as PDF. */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Reset page container padding for edge-to-edge headers. */
        .container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }

        /* --- Two-column landscape layout ---
           Grid areas: header spans both columns, metrics on the left,
           narratives on the right, footer full-width at the bottom.
           Tailwind space-y-* margins on the doc's direct children are
           zeroed out below so grid gap controls spacing. */
        .report-card-doc {
          display: grid;
          grid-template-columns: 32% 1fr;
          grid-template-areas:
            "header    header"
            "metrics   narratives"
            "footer    footer";
          column-gap: 14pt;
          row-gap: 6pt;
          page-break-inside: avoid;
        }
        /* Multiple report cards stacked on one page (bulk review/print) —
           each starts on its own printed page. A no-op when only one
           .report-card-doc exists on the page (the single-player editor). */
        .report-card-doc + .report-card-doc {
          page-break-before: always;
          break-before: page;
        }
        .report-card-doc > * { margin-top: 0 !important; margin-bottom: 0 !important; }
        .rc-header { grid-area: header; }
        .rc-metrics-slot { grid-area: metrics; }
        .rc-narratives-slot { grid-area: narratives; }
        .rc-footer { grid-area: footer; }

        /* --- Branded header --- */
        .rc-header {
          border: none !important;
          border-radius: 0 !important;
          background: white !important;
          page-break-after: avoid;
        }
        .rc-header-band {
          height: 4pt;
          border-radius: 0 !important;
        }
        .rc-header-inner {
          padding: 6pt 0 5pt 0;
          border-bottom: 0.75pt solid #222;
          gap: 12pt !important;
        }
        .rc-logo { height: 36pt; }
        .rc-eyebrow {
          color: #6b7280 !important;
          font-size: 7pt;
        }
        .rc-player-name {
          color: #111 !important;
          font-size: 18pt;
        }
        .rc-period {
          color: #4b5563 !important;
          font-size: 9.5pt;
        }

        /* --- Card container styling — clean, borderless in print --- */
        .glass-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          page-break-inside: avoid;
        }
        /* Trim card header/content padding so more content fits. */
        .glass-card [class*="CardHeader"], .rc-narratives-slot [class*="pb-2"] {
          padding: 0 !important;
        }

        /* --- Section headings --- */
        [class*="uppercase"][class*="tracking-wider"] {
          color: #111 !important;
          font-size: 8.5pt !important;
          letter-spacing: 0.1em !important;
          border-bottom: 0.5pt solid #d1d5db !important;
          padding-bottom: 1pt !important;
          margin-bottom: 2pt !important;
        }

        /* --- Narrative copy in print --- flows as a paragraph so
           the full content prints (textareas don't auto-grow). */
        .rc-print-copy {
          color: #111 !important;
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
          font-size: 8.25pt !important;
          line-height: 1.25 !important;
          margin: 0 0 3pt 0 !important;
        }
        .rc-narratives-slot { font-size: 8.25pt; }
        .rc-narratives-slot .glass-card + .glass-card { margin-top: 3pt !important; }

        /* --- Metrics panel — tighter for landscape column --- */
        .rc-metrics-slot .space-y-3 > * + * { margin-top: 5pt !important; }
        .rc-metrics-slot .text-sm { font-size: 8.5pt !important; }
        .rc-metrics-slot .text-xs { font-size: 7.5pt !important; }
        /* Metric names + band labels ("On Target", etc.) otherwise follow
           the live --foreground CSS var, which is white in dark mode (the
           app's default) — invisible on the forced-white printed page.
           Force them dark like every other bit of print copy. */
        .rc-metric-label { color: #111 !important; }

        /* --- Print-only branded footer --- */
        .rc-footer {
          display: flex !important;
          justify-content: space-between;
          align-items: center;
          border-top: 0.5pt solid #d1d5db;
          padding-top: 3pt;
          margin-top: 5pt !important;
          font-size: 7pt;
          color: #6b7280;
          page-break-inside: avoid;
        }
      }
    `}</style>
  );
}
