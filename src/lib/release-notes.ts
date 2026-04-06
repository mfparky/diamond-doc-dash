export interface ReleaseFeature {
  heading: string;
  description: string;
}

export interface ReleaseNotes {
  version: string;
  enabled: boolean;
  title: string;
  features: ReleaseFeature[];
}

export const CURRENT_RELEASE: ReleaseNotes = {
  version: "2026-04-06",
  enabled: false,
  title: "What's New 🎉",
  features: [
    {
      heading: "🏋️ Workout Wall & Leaderboard",
      description: "A full-page photo wall celebrates your players' hard work, plus a live leaderboard with animated counters to track who's putting in the reps.",
    },
    {
      heading: "📊 Session Breakdown Reorder",
      description: "The workout completion counter now sits above the session breakdown for a cleaner, more intuitive layout.",
    },
    {
      heading: "👨‍👩‍👦 Parent Dashboard Improvements",
      description: "Workout photos no longer break the layout — they're now static previews with a 'View Team Wall' link for the full experience.",
    },
    {
      heading: "📸 Image Optimization",
      description: "Workout photos are auto-compressed for faster loading without losing quality.",
    },
    {
      heading: "🔔 What's New Updates",
      description: "You'll now see a quick summary like this whenever we ship improvements. Coaches control when it goes live.",
    },
  ],
};
