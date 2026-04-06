import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Camera, X, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GalleryPhoto {
  id: string;
  photoUrl: string;
  notes: string | null;
  weekStart: string;
  dayOfWeek: number;
  workoutTitle: string;
  pitcherName?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WorkoutGalleryProps {
  pitcherId?: string;
  pitcherIds?: string[];
  teamId?: string;
  /** Called with photo count when data loads */
  onPhotoCount?: (count: number) => void;
}

export function WorkoutGallery({ pitcherId, pitcherIds: propPitcherIds, teamId, onPhotoCount }: WorkoutGalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);

    let pitcherIds: string[] = [];
    let pitcherNameMap: Record<string, string> = {};

    if (propPitcherIds && propPitcherIds.length > 0) {
      pitcherIds = propPitcherIds;
      const { data: pitchers } = await supabase
        .from('pitchers')
        .select('id, name')
        .in('id', propPitcherIds);
      if (pitchers) {
        pitcherNameMap = Object.fromEntries(pitchers.map((p) => [p.id, p.name]));
      }
    } else if (teamId) {
      const { data: pitchers } = await supabase
        .from('pitchers')
        .select('id, name')
        .eq('team_id', teamId);
      if (pitchers) {
        pitcherIds = pitchers.map((p) => p.id);
        pitcherNameMap = Object.fromEntries(pitchers.map((p) => [p.id, p.name]));
      }
    } else if (pitcherId) {
      pitcherIds = [pitcherId];
    }

    if (pitcherIds.length === 0) {
      setPhotos([]);
      onPhotoCount?.(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('workout_completions')
      .select(`
        id,
        photo_url,
        notes,
        week_start,
        day_of_week,
        pitcher_id,
        workout_assignments ( title )
      `)
      .in('pitcher_id', pitcherIds)
      .not('photo_url', 'is', null)
      .order('week_start', { ascending: false })
      .order('day_of_week', { ascending: false });

    if (!error && data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        photoUrl: row.photo_url,
        notes: row.notes,
        weekStart: row.week_start,
        dayOfWeek: row.day_of_week,
        workoutTitle: row.workout_assignments?.title ?? 'Workout',
        pitcherName: pitcherNameMap[row.pitcher_id],
      }));
      setPhotos(mapped);
      onPhotoCount?.(mapped.length);
    }
    setLoading(false);
  }, [pitcherId, propPitcherIds, teamId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6 px-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted/30 animate-pulse">
            <div className="h-10 rounded-t-2xl bg-muted/40" />
            <div className="aspect-[4/3] bg-muted/20" />
            <div className="h-8 rounded-b-2xl bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  /* ── Empty state ── */
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
          <Camera className="w-8 h-8 opacity-40" />
        </div>
        <p className="text-sm font-medium">No workout photos yet</p>
        <p className="text-xs text-muted-foreground/60">Photos will appear here as players check in</p>
      </div>
    );
  }

  /* ── Social feed ── */
  return (
    <>
      {/* Header stats bar */}
      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="flex items-center gap-1.5 text-primary">
          <Flame className="w-5 h-5" />
          <span className="text-sm font-bold">{photos.length}</span>
          <span className="text-xs text-muted-foreground font-medium">check-in{photos.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Team Wall</span>
      </div>

      {/* Feed */}
      <div className="space-y-5 px-1">
        {photos.map((photo, idx) => {
          const weekDate = parseISO(photo.weekStart);
          const dayLabel = DAY_LABELS[photo.dayOfWeek] ?? '';
          const dateLabel = format(weekDate, 'MMM d, yyyy');
          const initials = (photo.pitcherName || 'P')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={photo.id} className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              {/* Card header – player info */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {photo.pitcherName || 'Player'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {dayLabel} · {dateLabel}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full font-medium">
                  {photo.workoutTitle}
                </span>
              </div>

              {/* Photo */}
              <button
                className="w-full focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset"
                onClick={() => setLightboxIndex(idx)}
              >
                <img
                  src={photo.photoUrl}
                  alt={`${photo.pitcherName || 'Player'} – ${photo.workoutTitle}`}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
              </button>

              {/* Notes */}
              {photo.notes && (
                <div className="px-4 py-3 border-t">
                  <p className="text-sm text-foreground/80 italic leading-relaxed">
                    "{photo.notes}"
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-7 h-7" />
          </button>

          {lightboxIndex! > 0 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex! - 1); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {lightboxIndex! < photos.length - 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex! + 1); }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.photoUrl}
              alt={lightboxPhoto.workoutTitle}
              className="max-w-full max-h-[70vh] rounded-xl object-contain"
            />
            <div className="text-center">
              <p className="text-white font-semibold text-sm">
                {lightboxPhoto.pitcherName && `${lightboxPhoto.pitcherName} · `}
                {lightboxPhoto.workoutTitle}
              </p>
              <p className="text-white/50 text-xs">
                {DAY_LABELS[lightboxPhoto.dayOfWeek]} · {format(parseISO(lightboxPhoto.weekStart), 'MMM d, yyyy')}
              </p>
              {lightboxPhoto.notes && (
                <p className="text-white/70 text-xs mt-1 max-w-sm mx-auto italic">"{lightboxPhoto.notes}"</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
