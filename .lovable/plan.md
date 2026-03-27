

## Problem: App stuck on "Loading..." screen

### Root Cause

The `useAuth` hook performs async work (`checkApproval` database query + potential `signOut`) inside the `onAuthStateChange` callback. Supabase docs warn against this — async operations in the callback can block the auth state machine, causing the listener to silently stall. The token refresh succeeds (visible in network logs) but no `user_approvals` query ever fires, confirming the callback is deadlocked.

### Fix

Refactor `src/hooks/use-auth.ts` to separate concerns:

1. **`onAuthStateChange`**: Only do synchronous state updates (set session/user immediately). No database queries, no signOut calls inside the callback.

2. **Separate approval check**: Use a `useEffect` that watches the `session` state. When a session exists, run `checkApproval`. If unapproved, sign out and set `pendingApproval`. This keeps async work outside the auth listener.

3. **Loading state**: Start as `true`, set to `false` after the initial `getSession` + approval check completes. The `onAuthStateChange` listener only updates session/user reactively.

```text
Before (broken):
  onAuthStateChange → async checkApproval → async signOut → deadlock

After (fixed):
  onAuthStateChange → set session (sync)
  useEffect([session]) → checkApproval → signOut if needed
```

### Technical Details

**File: `src/hooks/use-auth.ts`**

- `onAuthStateChange` callback: just `setSession(session)` and `setUser(session?.user ?? null)`, plus `setLoading(false)` on first call
- New `useEffect` watching `session`: if `session?.user`, call `checkApproval`. If not approved, call `signOut()` and set `pendingApproval = true`. If approved, clear pending state. Set `loading = false` after check.
- `getSession` on mount: set session synchronously, let the effect handle approval
- Keep `signIn`/`signUp`/`signOut` methods unchanged

