import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.auth.admin.updateUserById(
    'd187be3a-7e1c-4a6d-9db4-634716e93fb4',
    { password: 'Baseball!123', email_confirm: true }
  );

  return new Response(
    JSON.stringify({ success: !error, error: error?.message, user: data?.user?.email }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
