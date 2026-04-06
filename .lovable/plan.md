

## Plan: Coach-Only Global Design System (Backend-Controlled)

### Problem
Currently, the design system switcher is client-side only — each user's browser stores their own theme in `localStorage`. You want to set the theme **once** as the coach, and have **all users** (parents, public dashboards) see that theme.

### Approach
Store the active design system ID in the `teams` table (where you already store dashboard settings). The app reads the team's theme on load and applies it globally. Only authenticated coaches can change it; everyone else just receives it.

### Changes

**1. Database migration** — Add `design_system` column to `teams`
- `ALTER TABLE teams ADD COLUMN design_system text DEFAULT 'default';`
- No new RLS needed — `teams` already has anon SELECT access for public dashboards

**2. `src/contexts/DesignSystemContext.tsx`** — Fetch theme from Supabase
- On mount, query the team's `design_system` value (using the team ID from context or a default query)
- Fall back to `'default'` if no team found
- Remove `localStorage` persistence — the DB is the source of truth
- Keep `setSystem()` but have it **write to the DB** (only works for authenticated coaches)

**3. `src/pages/DesignSystemPage.tsx`** — Auth-gate the switcher
- Require authentication to access `/design-systems`
- When a theme is selected, call `supabase.from('teams').update({ design_system: id })` for the coach's team
- Show a success toast confirming the change is live for all users

**4. Public dashboards** (PlayerDashboard, TeamDashboard, TeamWallPage)
- These already sit inside `DesignSystemProvider`
- They'll automatically pick up the team's theme from the DB query

### Flow
```text
Coach visits /design-systems → selects "Stripe" → saved to teams.design_system
  ↓
Parent visits /player/:id → DesignSystemProvider loads team theme → Stripe applied
```

### What This Gives You
- One place to set the look for the entire app
- Parents and public viewers see whatever you chose — no localStorage dependency
- Changing it back is instant (select Default, save)

