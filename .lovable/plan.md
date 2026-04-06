

## Plan: Disable Photo Clicks on Player Dashboard, Add "Launch Wall" Link

### Problem
Clicking a workout photo on the parent-facing PlayerDashboard opens a lightbox that breaks the layout (overlays incorrectly on the page).

### Changes

**1. `src/components/WorkoutGallery.tsx`** — Add a `disableLightbox` prop
- When `true`, render photos as plain `<div>` instead of `<button>`, remove click handler and hover scale effect
- Remove lightbox rendering when disabled
- Default to `false` so TeamWallPage and other uses are unaffected

**2. `src/pages/PlayerDashboard.tsx`** — Replace clickable gallery with static preview + wall link
- Pass `disableLightbox` to `WorkoutGallery`
- Add a "View Team Wall" link/button in the gallery card header that navigates to `/wall/${teamId}` (or `/wall/hawks12uAA` as fallback)

### Result
Photos on the player dashboard become non-interactive thumbnails. A clear "Team Wall" link takes users to the full-page experience where the lightbox works properly.

