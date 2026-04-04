import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Camera, X } from 'lucide-react';

interface GalleryPhoto {
  id: string;
  photoUrl: string;
  notes: string | null;
  weekStart: string;
  dayOfWeek: number;
  workoutTitle: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WorkoutGalleryProps {
  pitcherId: string;
  pitcherName?: string;
}

export function WorkoutGallery({ pitcherId, pitcherName }: WorkoutGalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workout_completions')
      .select(`
        id,
        photo_url,
        notes,
        week_start,
        day_of_week,
        workout_assignments ( title )
      `)
      .eq('pitcher_id', pitcherId)
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
        }))
      );
    }
    setLoading(false);
  }, [pitcherId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Camera className="w-8 h-8 opacity-30" />
        <p className="text-sm">No workout photos yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => {
          const weekDate = parseISO(photo.weekStart);
          const dayLabel = DAY_LABELS[photo.dayOfWeek] ?? '';
          const dateLabel = format(weekDate, 'MMM d');

          return (
            <button
              key={photo.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setLightboxUrl(photo.photoUrl)}
            >
              <img
                src={photo.photoUrl}
                alt={photo.workoutTitle}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* Caption overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <p className="text-white text-xs font-semibold leading-tight truncate">{photo.workoutTitle}</p>
                <p className="text-white/70 text-[10px] leading-tight">{dayLabel} · {dateLabel}</p>
                {photo.notes && (
                  <p className="text-white/60 text-[10px] leading-tight mt-0.5 line-clamp-1">{photo.notes}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightboxUrl}
            alt="Workout photo"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
