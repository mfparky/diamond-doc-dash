

## Plan: "What's New" Release Notes Modal with Coach Toggle

### Overview

A release notes modal that shows once per user per version, with a toggle in coach Settings so you can turn it on/off before deploying.

### How It Works

```text
Coach edits release-notes.ts → sets enabled: true → deploys
  ↓
User logs in → localStorage check: lastSeenRelease_{userId} vs version
  ↓
If mismatch AND enabled === true → show modal
  ↓
User clicks "Got it" → save version to localStorage
```

The coach toggle is a simple `enabled` boolean in the config file. Set it to `false` while drafting, flip to `true` when ready. No database needed.

### Files

**1. New: `src/lib/release-notes.ts`**

Static config file with:
- `version`: string (e.g. `"2026-04-06"`)
- `enabled`: boolean — the on/off toggle. Set `false` to suppress the modal entirely
- `title`: string
- `features`: array of `{ heading, description }` objects

Initial content will cover the recent features: Workout Wall, Coach Notifications, Image Optimization, Workout Counter.

**2. New: `src/components/WhatsNewDialog.tsx`**

- Reads `CURRENT_RELEASE` from the config
- If `enabled` is `false`, renders nothing
- Checks `localStorage` key `whatsNew_{userId}` against `version`
- If new version, auto-opens a clean dialog with feature list
- "Got it" button saves version to localStorage and closes
- Styled consistently with existing dialogs (glass-card aesthetic)

**3. Modified: `src/pages/Index.tsx`**

- Import and render `<WhatsNewDialog />` inside the authenticated Index page
- Pass the user ID from `useAuth` (already available via App.tsx context — we'll thread it through or use `useAuth` directly in the dialog)

### Toggle Workflow

To control releases:
1. Edit `src/lib/release-notes.ts`
2. Set `enabled: false` while writing the message
3. Preview locally to check copy
4. Set `enabled: true` and deploy

No database, no settings UI — just a code toggle that you review before each push.

