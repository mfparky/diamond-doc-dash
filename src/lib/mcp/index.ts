import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPitchersTool from "./tools/list-pitchers";
import listRecentOutingsTool from "./tools/list-recent-outings";
import listTeamsTool from "./tools/list-teams";
import logOutingTool from "./tools/log-outing";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Never derive it from SUPABASE_URL (which may be a proxy). See knowledge notes.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "arm-stats-mcp",
  title: "Arm Stats",
  version: "0.1.0",
  instructions:
    "Tools for Arm Stats (Arm Care Tracker). Coaches can list their teams and pitchers, review recent outings, and log new bullpen/game/practice/external outings for a pitcher. All tools act as the signed-in Arm Stats user and respect team-based row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTeamsTool, listPitchersTool, listRecentOutingsTool, logOutingTool],
});
