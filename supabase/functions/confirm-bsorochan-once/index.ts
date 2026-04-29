import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_ID = 'd187be3a-7e1c-4a6d-9db4-634716e93fb4';
const EMAIL = 'bsorochan@yahoo.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(USER_ID);
    if (getUserError) throw getUserError;
    if (userData.user?.email?.toLowerCase() !== EMAIL) {
      return new Response(JSON.stringify({ error: 'Target user mismatch' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(USER_ID, {
      email_confirm: true,
    });
    if (updateError) throw updateError;

    const { error: approvalError } = await supabase
      .from('user_approvals')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('user_id', USER_ID)
      .eq('email', EMAIL);
    if (approvalError) throw approvalError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
