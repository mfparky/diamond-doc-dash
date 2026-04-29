import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabase.auth.getUser(callerToken);

    if (!caller) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ownerMembership, error: ownerError } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', caller.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (ownerError) throw ownerError;

    if (!ownerMembership) {
      return new Response(JSON.stringify({ error: 'Team owner access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, user_id } = await req.json();

    if (action === 'approve') {
      // Approve a user
      const { error } = await supabase
        .from('user_approvals')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('user_id', user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: 'User approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'confirm_email') {
      const { error: authError } = await supabase.auth.admin.updateUserById(user_id, {
        email_confirm: true,
      });

      if (authError) throw authError;

      const { error: approvalError } = await supabase
        .from('user_approvals')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('user_id', user_id);

      if (approvalError) throw approvalError;

      return new Response(JSON.stringify({ success: true, message: 'User email confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('user_approvals')
        .update({ status: 'rejected' })
        .eq('user_id', user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: 'User rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_pending') {
      const { data, error } = await supabase
        .from('user_approvals')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ pending: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
