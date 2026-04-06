

## Plan: Coach Workout Notifications + Image Compression

### Two Features

**1. Workout Activity Notifications on Coach Player Dashboard**

The coach views a player via `PitcherDetail.tsx`, which already renders `WorkoutCompletionDisplay`. Currently, completed days show a checkmark with tiny icons for notes/photos, but:
- Notes are only visible via hover `title` attribute (not clickable/readable)
- No notification indicator that new activity has happened
- Photos open in a new tab with no context

**Changes:**

- **`WorkoutCompletionDisplay.tsx`**: Add a clickable interaction on completed day cells. When a day has notes or a photo, tapping opens a small popover/dialog showing:
  - The note text (readable, not just a tooltip)
  - The photo inline (thumbnail that can be tapped to enlarge)
  - Timestamp context (which day, which workout)

- **`WorkoutCompletionDisplay.tsx`**: Add a simple "new activity" indicator. Query `workout_completions` for the pitcher, ordered by `created_at DESC`, and show a small dot/badge on days that have completions from the last 48 hours (or since the coach last viewed). For MVP simplicity, we'll use a "recent" approach — highlight completions from the last 48 hours with a pulsing dot, no server-side read tracking needed.

- **`PitcherDetail.tsx`**: Add a small notification badge next to the "Weekly Accountability" section header showing count of recent completions (e.g., "3 new this week").

**2. Image Compression — Down-res Parent Uploads**

Currently in `use-workouts.ts`, `compressImage` resizes to max 1024px and uses JPEG quality 0.85. For a 3-5MB target that still looks good on mobile:
- **Resolution**: Increase max dimension to ~1920px (full HD on longest side)
- **JPEG quality**: 0.80
- This produces images around 1-4MB depending on content — well within the 3-5MB range while looking sharp on any phone screen.

If the goal is to keep images *under* 3-5MB (not targeting that size), then the current 1024px is actually already very aggressive. The better approach: bump to 1920px max, quality 0.80, producing high-quality photos that stay under 5MB.

**Changes:**
- **`src/hooks/use-workouts.ts`**: Update `compressImage`:
  - `MAX` from 1024 → 1920
  - Quality from 0.85 → 0.80
  - Add a secondary check: if the resulting blob is still > 5MB, re-compress at lower quality (0.65)

### Files to Modify

1. **`src/components/WorkoutCompletionDisplay.tsx`** — Add clickable day cells with popover showing notes/photo; add "recent" pulsing dot on new completions; fetch `created_at` with completion data
2. **`src/components/PitcherDetail.tsx`** — Add recent activity count badge near the Accountability header
3. **`src/hooks/use-workouts.ts`** — Update `compressImage` to 1920px max, 0.80 quality, with 5MB fallback re-compression

