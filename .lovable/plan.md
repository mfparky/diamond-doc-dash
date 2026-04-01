

## Plan: Three Dashboard Improvements

### 1. Coach sees workout photos (WorkoutCompletionDisplay)

**Problem**: The query on line 60 of `WorkoutCompletionDisplay.tsx` selects `'id, assignment_id, day_of_week, notes'` — missing `photo_url`.

**Fix**: Add `photo_url` to the select string. The mapping at line 84 already handles `(c as any).photo_url`, so photos will render once fetched.

**File**: `src/components/WorkoutCompletionDisplay.tsx` (1-line change)

---

### 2. Parent sees coach-set achievement window dates

**Problem**: The achievement window is stored only in `localStorage` on the coach's browser. Parents on public dashboards never see it. The `teams` table already has `leaderboard_from` and `leaderboard_to` date columns — these are the right place to persist the window.

**Changes**:

- **RosterManagementDialog**: When coach changes the achievement date, also write it to the `teams` table (`leaderboard_from` column). On dialog open, read from `teams` table to initialize the date.

- **PlayerDashboard**: After fetching pitcher data (which already gets `team_id`), also fetch the team's `leaderboard_from` and `leaderboard_to`. Pass these dates to the `AccountabilityDialog` and `BadgeGrid` to use instead of the localStorage-based `useAchievementWindow`.

- **AccountabilityDialog**: Accept optional `achievementStart`/`achievementEnd` props and display the date range as a subtitle (e.g., "Apr 1 – May 1") in the dialog header.

**Files**: `src/components/RosterManagementDialog.tsx`, `src/pages/PlayerDashboard.tsx`, `src/components/AccountabilityDialog.tsx`

No migration needed — `leaderboard_from` and `leaderboard_to` already exist on the `teams` table.

---

### 3. Reorder coach player dashboard sections

**Problem**: Stats grid and focus/notes are below badges and accountability. Coach wants them higher.

**Current order in `PitcherDetail.tsx`** (lines 296–500+):
1. Share with Parents (line 297)
2. Badges + Accountability + Coach Notes (lines 299–325)
3. Stats Grid (lines 327–399)
4. Focus/Notes & Latest Video (lines 401+)

**New order**:
1. Share with Parents
2. Stats Grid (moved up)
3. Focus/Notes & Latest Video (moved up)
4. Badges + Accountability + Coach Notes (moved down)

**File**: `src/components/PitcherDetail.tsx` (block reorder, no logic changes)

