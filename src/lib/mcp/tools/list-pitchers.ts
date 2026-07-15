import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_pitchers",
  title: "List pitchers",
  description:
    "List pitchers visible to the signed-in Arm Stats user (scoped by team membership via RLS). Returns id, name, and team_id.",
  inputSchema: {
    team_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional team UUID to filter by. Omit to list across all of the user's teams."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb.from("pitchers").select("id, name, team_id").order("name", { ascending: true });
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { pitchers: data ?? [] },
    };
  },
});
