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

interface UseAllStatSnapshotsResult {
  /** Map of pitcherId → snapshots for that pitcher, newest first. */
  byPitcher: Map<string, StatSnapshot[]>;
  /** The single most recent snapshot timestamp across all pitchers. */
  mostRecentUploadedAt: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Bulk fetch for the team view — one round-trip covers every pitcher whose
 * id appears in `pitcherIds`. Empty input -> no query.
 */
export function useAllStatSnapshots(pitcherIds: string[]): UseAllStatSnapshotsResult {
  const [byPitcher, setByPitcher] = useState<Map<string, StatSnapshot[]>>(new Map());
  const [mostRecent, setMostRecent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Stable key so the effect doesn't churn on every render of a new array
  // reference holding the same ids.
  const key = pitcherIds.slice().sort().join(',');

  const fetchSnapshots = useCallback(async () => {
    if (pitcherIds.length === 0) {
      setByPitcher(new Map());
      setMostRecent(null);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pitcher_stat_snapshots')
        .select('id, pitcher_id, uploaded_at, source_filename, stats')
        .in('pitcher_id', pitcherIds)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      const grouped = new Map<string, StatSnapshot[]>();
      let recent: string | null = null;
      for (const row of data ?? []) {
        const snap = mapRow(row);
        const arr = grouped.get(snap.pitcherId) ?? [];
        arr.push(snap);
        grouped.set(snap.pitcherId, arr);
        if (!recent || snap.uploadedAt > recent) recent = snap.uploadedAt;
      }
      setByPitcher(grouped);
      setMostRecent(recent);
    } catch (e) {
      console.error('Error loading team stat snapshots:', e);
      toast({
        title: 'Could not load team snapshots',
        description: 'Refresh or re-upload the CSV.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, toast]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  return { byPitcher, mostRecentUploadedAt: mostRecent, isLoading, refetch: fetchSnapshots };
}

export interface PendingSnapshotInsert {
  pitcherId: string;
  stats: Record<string, StatValue>;
}

export interface LastUploadInfo {
  uploadedAt: string;
  sourceFilename: string | null;
  pitcherCount: number;
}

interface UseStatUploadResult {
  upload: (rows: PendingSnapshotInsert[], sourceFilename: string | null) => Promise<boolean>;
  /** Look up the most recent upload batch (for a confirm prompt). */
  getLastUpload: () => Promise<LastUploadInfo | null>;
  /** Delete the most recent upload batch. Returns rows removed, or null on error. */
  undoLastUpload: () => Promise<number | null>;
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

  const getLastUpload = useCallback(async (): Promise<LastUploadInfo | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // Newest batch = rows sharing the max uploaded_at.
      const { data: latest, error } = await supabase
        .from('pitcher_stat_snapshots')
        .select('uploaded_at, source_filename')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!latest) return null;
      const { count, error: countErr } = await supabase
        .from('pitcher_stat_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('uploaded_at', latest.uploaded_at);
      if (countErr) throw countErr;
      return {
        uploadedAt: latest.uploaded_at,
        sourceFilename: latest.source_filename,
        pitcherCount: count ?? 0,
      };
    } catch (e) {
      console.error('Error reading last upload:', e);
      return null;
    }
  }, []);

  const undoLastUpload = useCallback(async (): Promise<number | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Sign in required', variant: 'destructive' });
        return null;
      }
      const { data: latest, error: findErr } = await supabase
        .from('pitcher_stat_snapshots')
        .select('uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!latest) {
        toast({ title: 'Nothing to undo', description: 'No stat uploads found.' });
        return 0;
      }
      const { data: deleted, error: delErr } = await supabase
        .from('pitcher_stat_snapshots')
        .delete()
        .eq('user_id', user.id)
        .eq('uploaded_at', latest.uploaded_at)
        .select('id');
      if (delErr) throw delErr;
      const n = deleted?.length ?? 0;
      toast({
        title: 'Last upload removed',
        description: `Deleted ${n} snapshot${n === 1 ? '' : 's'}. Upload your new stats to show change vs the previous set.`,
      });
      return n;
    } catch (e) {
      console.error('Error undoing last upload:', e);
      toast({
        title: 'Could not undo upload',
        description: 'Try again, or use the Supabase SQL editor.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  return { upload, getLastUpload, undoLastUpload, isUploading };
}
