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
  name: "log_outing",
  title: "Log an outing",
  description:
    "Insert a pitching outing (bullpen, game, practice, or external) for a pitcher. Acts as the signed-in Arm Stats user; RLS enforces team membership.",
  inputSchema: {
    pitcher_id: z.string().describe("The pitcher_id string on the pitchers row."),
    pitcher_name: z.string().min(1).describe("The pitcher's display name."),
    team_id: z.string().uuid().describe("Team UUID this outing belongs to."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Outing date (YYYY-MM-DD, local)."),
    event_type: z
      .enum(["bullpen", "game", "practice", "external"])
      .describe("Kind of outing."),
    pitch_count: z.number().int().min(0).max(500),
    strikes: z.number().int().min(0).max(500).nullable().optional().describe("Strike count. Null if not tracked."),
    max_velocity: z.number().int().min(0).max(120).nullable().optional(),
    focus: z.string().max(500).optional().describe("Mechanical focus / cue."),
    notes: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("outings")
      .insert({
        pitcher_id: input.pitcher_id,
        pitcher_name: input.pitcher_name,
        team_id: input.team_id,
        user_id: ctx.getUserId(),
        date: input.date,
        event_type: input.event_type,
        pitch_count: input.pitch_count,
        strikes: input.strikes ?? null,
        max_velocity: input.max_velocity ?? null,
        focus: input.focus ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged outing ${data.id}` }],
      structuredContent: { outing: data },
    };
  },
});
