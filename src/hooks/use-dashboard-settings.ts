import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DashboardSettings {
  workoutsEnabled: boolean;
}

const DEFAULTS: DashboardSettings = {
  workoutsEnabled: true,
};

interface UseDashboardSettingsResult {
  settings: DashboardSettings;
  isLoading: boolean;
  setWorkoutsEnabled: (enabled: boolean) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Per-coach preference store. Reads on mount and persists via upsert so the
 * first toggle creates the row if the coach has never opened settings before.
 */
export function useDashboardSettings(): UseDashboardSettingsResult {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSettings(DEFAULTS);
        return;
      }
      const { data, error } = await supabase
        .from('dashboard_settings')
        .select('workouts_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setSettings({
        workoutsEnabled: data?.workouts_enabled ?? true,
      });
    } catch (e) {
      console.error('Error loading dashboard settings:', e);
      // Soft-fail: keep DEFAULTS so the UI doesn't break for an existing user.
      setSettings(DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setWorkoutsEnabled = useCallback(
    async (enabled: boolean) => {
      const previous = settings.workoutsEnabled;
      setSettings((prev) => ({ ...prev, workoutsEnabled: enabled }));
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: 'Sign in required',
            description: 'You must be signed in to change settings.',
            variant: 'destructive',
          });
          setSettings((prev) => ({ ...prev, workoutsEnabled: previous }));
          return false;
        }
        const { error } = await supabase
          .from('dashboard_settings')
          .upsert(
            { user_id: user.id, workouts_enabled: enabled },
            { onConflict: 'user_id' },
          );
        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Error saving workouts_enabled:', e);
        setSettings((prev) => ({ ...prev, workoutsEnabled: previous }));
        toast({
          title: 'Could not save setting',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [settings.workoutsEnabled, toast],
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading, setWorkoutsEnabled, refetch: fetchSettings };
}
