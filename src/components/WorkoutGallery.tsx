import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Camera, X, ChevronLeft, ChevronRight, Flame } from "lucide-react";

interface GalleryPhoto {
  id: string;
  photoUrl: string;
  notes: string | null;
  weekStart: string;
  dayOfWeek: number;
  workoutTitle: string;
  pitcherName?: string;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WorkoutGalleryProps {
  pitcherId?: string;
  pitcherIds?: string[];
  teamId?: string;
  onPhotoCount?: (count: number) => void;
  disableLightbox?: boolean;
}

export function WorkoutGallery({
  pitcherId,
  pitcherIds: propPitcherIds,
  teamId,
  onPhotoCount,
  disableLightbox = false,
}: WorkoutGalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);

    let pitcherIds: string[] = [];
    let pitcherNameMap: Record<string, string> = {};

    if (propPitcherIds && propPitcherIds.length > 0) {
      pitcherIds = propPitcherIds;
      const { data: pitchers } = await supabase.from("pitchers").select("id, name").in("id", propPitcherIds);
      if (pitchers) {
        pitcherNameMap = Object.fromEntries(pitchers.map((p) => [p.id, p.name]));
      }
    } else if (teamId) {
      const { data: pitchers } = await supabase.from("pitchers").select("id, name").eq("team_id", teamId);
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
      .from("workout_completions")
      .select(
        `
        id,
        photo_url,
        notes,
        week_start,
        day_of_week,
        pitcher_id,
        workout_assignments ( title )
      `,
      )
      .in("pitcher_id", pitcherIds)
      .not("photo_url", "is", null)
      .order("week_start", { ascending: false })
      .order("day_of_week", { ascending: false });

    if (!error && data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        photoUrl: row.photo_url,
        notes: row.notes,
        weekStart: row.week_start,
        dayOfWeek: row.day_of_week,
        workoutTitle: row.workout_assignments?.title ?? "Workout",
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
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-muted/30 animate-pulse break-inside-avoid"
            style={{ height: `${140 + (i % 3) * 60}px` }}
          />
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

  /* ── Masonry grid ── */
  return (
    <>
      {/* Header stats */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-primary">
          <Flame className="w-5 h-5" />
          <span className="text-sm font-bold">{photos.length}</span>
          <span className="text-xs text-muted-foreground font-medium">check-in{photos.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Team Wall</span>
      </div>

      {/* Masonry layout */}
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3">
        {(() => {
          // Pick a random insertion index for the sponsor tile (stable per render)
          const sponsorIndex = Math.floor(Math.random() * (photos.length + 1));

          const sponsorTile = (
            <div
              key="sponsor-tile"
              className="break-inside-avoid rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#ffffff", minHeight: "280px" }}
            >
              <div className="h-full flex flex-col items-center justify-center px-4 py-4 gap-4">
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold text-center"
                  style={{ color: "#6b7280" }}
                >
                  Thank you to our sponsors
                </p>
                <div className="grid grid-cols-2 gap-4 place-items-center w-full">
                  <img
                    src="/sponsors/AVP-Logo_Black.png"
                    alt="AVP"
                    className="h-10 w-20 object-contain"
                    loading="lazy"
                  />
                  <img src="/sponsors/BYPVector.png" alt="BYP" className="h-10 w-20 object-contain" loading="lazy" />
                  <img
                    src="/sponsors/HVACTRUST.png"
                    alt="HVAC Trust"
                    className="h-10 w-20 object-contain"
                    loading="lazy"
                  />
                  <img
                    src="/sponsors/TremcarLOGO.png"
                    alt="Tremcar"
                    className="h-10 w-20 object-contain"
                    loading="lazy"
                  />
                  <img
                    src="/sponsors/reliance-new-logo.png"
                    alt="Reliance Home Comfort"
                    className="h-10 w-20 object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          );

          const items: React.ReactNode[] = [];
          photos.forEach((photo, idx) => {
            if (idx === sponsorIndex) items.push(sponsorTile);

            const weekDate = parseISO(photo.weekStart);
            const dayLabel = DAY_LABELS[photo.dayOfWeek] ?? "";
            const dateLabel = format(weekDate, "MMM d");
            const initials = (photo.pitcherName || "P")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            const Wrapper = disableLightbox ? ("div" as const) : ("button" as const);

            items.push(
              <Wrapper
                key={photo.id}
                className={`group relative w-full rounded-2xl overflow-hidden bg-muted/30 break-inside-avoid ${disableLightbox ? "" : "focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform hover:scale-[1.02]"}`}
                {...(!disableLightbox ? { onClick: () => setLightboxIndex(idx) } : {})}
              >
                <img
                  src={photo.photoUrl}
                  alt={`${photo.pitcherName || "Player"} – ${photo.workoutTitle}`}
                  className="w-full object-cover"
                  loading="lazy"
                />

                {/* Overlay */}
                {!disableLightbox && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {/* Bottom info — always visible */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[9px] font-bold shrink-0 backdrop-blur-sm">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-tight truncate">
                        {photo.pitcherName || "Player"}
                      </p>
                      <p className="text-white/60 text-[10px] leading-tight">
                        {dayLabel} · {dateLabel}
                      </p>
                    </div>
                  </div>
                  {photo.notes && (
                    <p className="text-white/70 text-[10px] mt-1.5 leading-snug line-clamp-2 italic">"{photo.notes}"</p>
                  )}
                </div>

                {/* Workout badge */}
                <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-[9px] font-medium px-2 py-0.5 rounded-full">
                  {photo.workoutTitle}
                </div>
              </Wrapper>,
            );
          });

          // If sponsor index is at the end
          if (sponsorIndex >= photos.length) items.push(sponsorTile);

          return items;
        })()}
      </div>

      {/* Lightbox */}
      {!disableLightbox && lightboxPhoto && (
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
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex! - 1);
              }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {lightboxIndex! < photos.length - 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex! + 1);
              }}
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
                {DAY_LABELS[lightboxPhoto.dayOfWeek]} · {format(parseISO(lightboxPhoto.weekStart), "MMM d, yyyy")}
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
