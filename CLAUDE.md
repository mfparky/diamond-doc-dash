Project Context: Arm Care Tracker (MVP)
1. Project Philosophy
Core Goal: Minimize the time from "Pitch Finished" to "Data Saved." Coaches are in a high-distraction environment; the interface must be frictionless.

Persona: The Youth Baseball Coach. They are often standing in a dugout, in bright sunlight, needing to log pitch counts and monitor arm fatigue in under 10 seconds.

Priority: Utility over aesthetics. If it doesn't help the coach track health or pitch volume, it stays out of the MVP.

2. Tech Stack & Workflow
Frontend: Lovable (UI components, layouts, rapid prototyping).

Database: Supabase (Auth, RDBMS, Real-time sync).

VCS: GitHub (Main branch deployments, PR-based workflow).

AI Tooling: Claude Code (CLI-driven development).

3. Coding & Style Guidelines
Tone: Concise, opinionated, and insightful. Skip the fluff. When suggesting code, explain why it fits the Supabase/Lovable paradigm.

Modularity: Keep functions small. Since this is an MVP, focus on CRUD operations that are easily readable.

Component Design: Prioritize mobile-first, high-contrast UI elements (large touch targets for dugout use).

Data Integrity: Assume all inputs require validation. Implement error handling that informs the coach immediately if a sync fails.

4. Key MVP Constraints
Coach-Centric: Focus on the "Add Pitch Session" flow.

Persistence: Data must be saved to Supabase instantly. Offline-first patterns are a "nice-to-have" but stability is mandatory.

Compliance: Recognize that this handles youth sports data. Avoid PII (Personally Identifiable Information) where possible; prioritize player IDs or nicknames.

5. Current Focus
Building the primary "Log Pitch Session" form.

Establishing the Supabase schema for coaches, players, and pitch_logs.

Ensuring the UI handles screen rotation/sunlight readability.
