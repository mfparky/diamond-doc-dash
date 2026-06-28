import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import type { StatValue } from '@/lib/stat-csv';

export interface StatSnapshot {
  id: string;
  pitcherId: string;
  uploadedAt: string;
  sourceFilename: string | null;
  stats: Record<string, StatValue>;
}

interface UseStatSnapshotsResult {
  /** Most recent snapshot for this pitcher (or null). */
  latest: StatSnapshot | null;
  /** Snapshot before the most recent — enables trend deltas. */
  previous: StatSnapshot | null;
  /** All snapshots, newest first. */
  all: StatSnapshot[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function mapRow(row: {
  id: string;
  pitcher_id: string;
  uploaded_at: string;
  source_filename: string | null;
  stats: Json;
}): StatSnapshot {
  return {
    id: row.id,
    pitcherId: row.pitcher_id,
    uploadedAt: row.uploaded_at,
    sourceFilename: row.source_filename,
    stats: (row.stats as Record<string, StatValue>) ?? {},
  };
}

export function useStatSnapshots(pitcherId: string | undefined): UseStatSnapshotsResult {
  const [all, setAll] = useState<StatSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSnapshots = useCallback(async () => {
    if (!pitcherId) {
      setAll([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pitcher_stat_snapshots')
        .select('id, pitcher_id, uploaded_at, source_filename, stats')
        .eq('pitcher_id', pitcherId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setAll((data ?? []).map(mapRow));
    } catch (e) {
      console.error('Error loading stat snapshots:', e);
      toast({
        title: 'Could not load stat snapshots',
        description: 'Try refreshing or re-uploading the CSV.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [pitcherId, toast]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  return {
    latest: all[0] ?? null,
    previous: all[1] ?? null,
    all,
    isLoading,
    refetch: fetchSnapshots,
  };
}

export interface PendingSnapshotInsert {
  pitcherId: string;
  stats: Record<string, StatValue>;
}

interface UseStatUploadResult {
  upload: (rows: PendingSnapshotInsert[], sourceFilename: string | null) => Promise<boolean>;
  isUploading: boolean;
}

/**
 * One-shot bulk insert of N pitcher snapshots from a single CSV upload.
 * Returns true on success; surfaces failures via toast.
 */
export function useStatUpload(): UseStatUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const upload = useCallback(
    async (rows: PendingSnapshotInsert[], sourceFilename: string | null) => {
      if (rows.length === 0) return false;
      setIsUploading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: 'Authentication required',
            description: 'Sign in before uploading season stats.',
            variant: 'destructive',
          });
          return false;
        }

        const payload = rows.map((r) => ({
          pitcher_id: r.pitcherId,
          user_id: user.id,
          source_filename: sourceFilename,
          stats: r.stats as unknown as Json,
        }));

        const { error } = await supabase.from('pitcher_stat_snapshots').insert(payload);
        if (error) throw error;

        toast({
          title: 'Stats uploaded',
          description: `Saved snapshots for ${rows.length} pitcher${rows.length === 1 ? '' : 's'}.`,
        });
        return true;
      } catch (e: unknown) {
        console.error('Error uploading stat snapshots:', e);
        const message = e instanceof Error && e.message.includes('row-level security')
          ? 'Permission denied — sign in as the team coach.'
          : 'Could not save the snapshots. Try again.';
        toast({
          title: 'Upload failed',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [toast],
  );

  return { upload, isUploading };
}
