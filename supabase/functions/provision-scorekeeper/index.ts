// One-shot provisioner for the default scorekeeper account.
// POST with no body. Idempotent: safe to re-run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEAM_ID = "df9e0d02-60e2-4379-906e-ddcc5e404fec";
const EMAIL = "scorekeeper@armstats.local";
const PASSWORD = "Hawks2014!?";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find or create the auth user
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
    if (existing) {
      userId = existing.id;
      // Reset password in case it drifted
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      userId = created.user!.id;
    }

    // 2. Approve them
    await admin.from("user_approvals").upsert(
      { user_id: userId, email: EMAIL, status: "approved", approved_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

    // 3. Add as scorekeeper on the active team (skip if already a member)
    const { data: existingMember } = await admin
      .from("team_members")
      .select("id, role")
      .eq("team_id", TEAM_ID)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingMember) {
      const { error: insErr } = await admin.from("team_members").insert({
        team_id: TEAM_ID,
        user_id: userId,
        role: "scorekeeper",
      });
      if (insErr) throw new Error(`team_members insert: ${insErr.message}`);
    } else if (existingMember.role !== "scorekeeper") {
      const { error: updErr } = await admin.from("team_members").update({ role: "scorekeeper" }).eq("id", existingMember.id);
      if (updErr) throw new Error(`team_members update: ${updErr.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email: EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
