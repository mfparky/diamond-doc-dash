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
      heading: "🏋️ Workout Wall",
      description: "A full-page photo wall celebrating your players' hard work — visible from the Team tab.",
    },
    {
      heading: "📊 Workout Leaderboard",
      description: "See who's putting in the reps with a live workout completion leaderboard and animated counter.",
    },
    {
      heading: "📸 Image Optimization",
      description: "Workout photos are now auto-compressed for faster loading without losing quality.",
    },
    {
      heading: "🔔 What's New Updates",
      description: "You'll now see a quick summary like this whenever we ship improvements.",
    },
  ],
};
