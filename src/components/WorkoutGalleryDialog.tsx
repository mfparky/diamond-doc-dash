import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

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

interface WorkoutGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single pitcher ID (parent view) */
  pitcherId?: string;
  /** Team ID — shows all team photos (coach view) */
  teamId?: string;
  title?: string;
}

export function WorkoutGalleryDialog({ open, onOpenChange, pitcherId, teamId, title }: WorkoutGalleryDialogProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);

    let pitcherIds: string[] = [];

    if (teamId) {
      const { data: pitchers } = await supabase
        .from('pitchers')
        .select('id, name')
        .eq('team_id', teamId);
      if (pitchers) {
        pitcherIds = pitchers.map((p) => p.id);
      }
    } else if (pitcherId) {
      pitcherIds = [pitcherId];
    }

    if (pitcherIds.length === 0) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    // Fetch pitcher names for team view
    let pitcherNameMap: Record<string, string> = {};
    if (teamId) {
      const { data: pitchers } = await supabase
        .from('pitchers')
        .select('id, name')
        .in('id', pitcherIds);
      if (pitchers) {
        pitcherNameMap = Object.fromEntries(pitchers.map((p) => [p.id, p.name]));
      }
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
      setPhotos(
        data.map((row: any) => ({
          id: row.id,
          photoUrl: row.photo_url,
          notes: row.notes,
          weekStart: row.week_start,
          dayOfWeek: row.day_of_week,
          workoutTitle: row.workout_assignments?.title ?? 'Workout',
          pitcherName: pitcherNameMap[row.pitcher_id],
        }))
      );
    }
    setLoading(false);
  }, [pitcherId, teamId]);

  useEffect(() => {
    if (open) fetchPhotos();
  }, [open, fetchPhotos]);

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title || 'Workout Gallery'}
          </DialogTitle>
          <DialogDescription>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} from workout check-ins.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Camera className="w-8 h-8 opacity-30" />
            <p className="text-sm">No workout photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => {
              const weekDate = parseISO(photo.weekStart);
              const dayLabel = DAY_LABELS[photo.dayOfWeek] ?? '';
              const dateLabel = format(weekDate, 'MMM d');

              return (
                <button
                  key={photo.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-[1.03]"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={photo.photoUrl}
                    alt={photo.workoutTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Always-visible gradient caption */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1.5">
                    <p className="text-white text-[10px] font-semibold leading-tight truncate">
                      {photo.pitcherName || photo.workoutTitle}
                    </p>
                    <p className="text-white/60 text-[9px] leading-tight">
                      {dayLabel} · {dateLabel}
                    </p>
                  </div>
                  {/* Notes indicator */}
                  {photo.notes && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>

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

          {/* Nav arrows */}
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
    </Dialog>
  );
}
