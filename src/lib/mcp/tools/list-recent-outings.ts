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
  name: "list_recent_outings",
  title: "List recent outings",
  description:
    "List recent pitching outings for the signed-in user (bullpens, games, practice, external). Returns date, pitcher, event type, pitch count, strikes, max velocity, notes.",
  inputSchema: {
    pitcher_name: z.string().trim().optional().describe("Filter by pitcher name (case-insensitive contains)."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Only include outings on/after this ISO date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ pitcher_name, limit, since }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("outings")
      .select(
        "id, date, pitcher_name, event_type, pitch_count, strikes, max_velocity, focus, notes, team_id",
      )
      .order("date", { ascending: false })
      .limit(limit ?? 20);
    if (pitcher_name) q = q.ilike("pitcher_name", `%${pitcher_name}%`);
    if (since) q = q.gte("date", since);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { outings: data ?? [] },
    };
  },
});
