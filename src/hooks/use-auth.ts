import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
  const initialCheckDone = useRef(false);

  const checkApproval = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('user_approvals')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return false;
    return data.status === 'approved';
  };

  // Listener: synchronous only
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      setSession(initSession);
      setUser(initSession?.user ?? null);
      if (!initSession?.user) {
        setLoading(false);
        initialCheckDone.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Async approval check, separate from auth listener
  useEffect(() => {
    if (!session?.user) {
      // No session — just make sure loading is off
      if (initialCheckDone.current) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    checkApproval(session.user.id).then(async (approved) => {
      if (cancelled) return;
      if (!approved) {
        setPendingApproval(true);
        setSession(null);
        setUser(null);
        await supabase.auth.signOut();
      } else {
        setPendingApproval(false);
      }
      setLoading(false);
      initialCheckDone.current = true;
    });

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      const approved = await checkApproval(data.user.id);
      if (!approved) {
        await supabase.auth.signOut();
        setPendingApproval(true);
        return { error: { message: 'Your account is pending approval. You will be notified when approved.' } as any };
      }
    }

    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (!error && data.user) {
      await supabase
        .from('user_approvals')
        .upsert({
          user_id: data.user.id,
          email,
          status: 'pending',
        }, { onConflict: 'user_id' });

      await supabase.auth.signOut();
      setPendingApproval(true);
    }

    return { error };
  };

  const signOut = async () => {
    setPendingApproval(false);
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return { user, session, loading, pendingApproval, signIn, signUp, signOut };
}
