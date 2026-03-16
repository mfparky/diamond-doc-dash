

## Plan

### 1. Fix build error in PaperFormScanner.tsx
Add the missing `PITCH_TYPE_COLORS` import on line 12.

### 2. Change Live ABs logging form to simplified fields
When `eventType === 'Live ABs'` is selected in `OutingForm.tsx`, replace the current `LiveAbCharter` component (which is the live pitch-by-pitch charting UI) with simple input fields:
- **Batters Faced** (number input)
- **Pitches** (number input — maps to pitchCount)
- **Strikes** (number input)
- **Balls** (number input, auto-calculated as pitches minus strikes)
- **Outcome** (optional select: K, K-L, BB, HBP, 1B, 2B, 3B, HR, GO, FO, LO, FC, E) — this would be a simple notes/summary field, not per-AB

Wait — re-reading the request: "batters faced, pitches, strikes, balls and optional outcome (hit/strikeout/walk/etc)". This sounds like summary-level fields for the whole outing, not per-AB tracking. The live charting session screen stays unchanged.

Updated approach for the Live ABs section in the outing form:
- Show standard fields: **Batters Faced**, **Pitch Count**, **Strikes**, **Balls** (auto-calc or manual)
- Add an optional **Outcome Summary** — a simple multi-select or text notes about outcomes
- Store batters faced in notes JSON, pitches/strikes in the normal fields

### 3. Auto-close date picker on selection
In both `OutingForm.tsx` and `EditOutingDialog.tsx`, use controlled `Popover` state (`open`/`onOpenChange`) so selecting a date closes the popover automatically.

---

### Technical details

**File: `src/components/PaperFormScanner.tsx`** (line 12)
- Change import to include `PITCH_TYPE_COLORS`: `import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';`

**File: `src/components/OutingForm.tsx`**
- Add controlled popover state (`datePickerOpen`) and close it in `handleDateSelect`
- Replace the `LiveAbCharter` section (lines 241-256) with simple numeric inputs:
  - Batters Faced (number)
  - Pitch Count (number) — reuse `formData.pitchCount`
  - Strikes (number) — reuse `formData.strikes`
  - Balls (auto-calculated display: pitchCount - strikes)
  - Optional outcome notes (free text or simple select for common outcomes)
- On submit for Live ABs, use pitchCount/strikes directly (no longer deriving from LiveAbCharter data)
- Store batters faced in notes JSON: `{ battersFaced: N, outcomeNotes: "..." }`
- Remove `LiveAbCharter` import and `liveAbData` state since it's no longer used in this form

**File: `src/components/EditOutingDialog.tsx`**
- Add controlled popover state and close on date selection

