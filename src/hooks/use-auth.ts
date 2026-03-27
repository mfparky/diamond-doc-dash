import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  const checkApproval = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('user_approvals')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      // No record yet — this is a brand new user, create pending record
      return false;
    }
    return data.status === 'approved';
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const approved = await checkApproval(session.user.id);
          if (!approved) {
            setPendingApproval(true);
            setSession(null);
            setUser(null);
            await supabase.auth.signOut();
          } else {
            setPendingApproval(false);
            setSession(session);
            setUser(session.user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const approved = await checkApproval(session.user.id);
        if (!approved) {
          setPendingApproval(true);
          setSession(null);
          setUser(null);
          await supabase.auth.signOut();
        } else {
          setPendingApproval(false);
          setSession(session);
          setUser(session.user);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

    // After signup, create a pending approval record
    if (!error && data.user) {
      await supabase
        .from('user_approvals')
        .upsert({
          user_id: data.user.id,
          email,
          status: 'pending',
        }, { onConflict: 'user_id' });

      // Sign them out immediately
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
