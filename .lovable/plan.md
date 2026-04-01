

## Plan: Optional Photo Upload on Workout Completions

### Summary
Allow parents to optionally attach a photo when completing a workout day. Photos upload to the existing `outing-videos` storage bucket and the URL is stored on the completion record.

### 1. Database Migration
Add nullable `photo_url` column to `workout_completions`:
```sql
ALTER TABLE workout_completions ADD COLUMN photo_url text;
```

### 2. Fix Build Error
**`supabase/functions/manage-approvals/index.ts`** — Cast `error` to `Error`: `(error as Error).message`

### 3. Hook Updates (`src/hooks/use-workouts.ts`)
- Add `photoUrl` to `WorkoutCompletion` interface
- Map `photo_url` in `fetchCompletions`
- Add `uploadCompletionPhoto(pitcherId, file)` — uploads to `outing-videos` bucket at `workouts/{pitcherId}/{timestamp}.{ext}`, returns public URL
- Add `updateCompletionPhoto(completionId, photoUrl)` — updates the record

### 4. UI: AccountabilityDialog (`src/components/AccountabilityDialog.tsx`)
- In the notes editing section (shown when tapping the comment icon on a completed day), add an optional "Add Photo" button with hidden file input (accept: image/*)
- Show thumbnail preview if a photo exists or was just uploaded
- Photo uploads immediately on selection; URL saved to completion record
- Small camera icon indicator on days that have photos

### 5. UI: WorkoutCompletionDisplay (`src/components/WorkoutCompletionDisplay.tsx`)
- Show camera icon on completed days that have photos
- Tapping opens photo in new tab

### Technical Details
- Storage path: `workouts/{pitcherId}/{timestamp}.{ext}` (matches existing convention)
- Accepted formats: JPEG, PNG, WebP, HEIC
- Photo is fully optional — no changes to the core toggle flow
- No file size limit enforced client-side beyond browser defaults

