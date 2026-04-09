export interface ReleaseFeature {
  heading: string;
  description: string;
}

export interface ReleaseNotes {
  version: string;
  enabled: boolean;
  title: string;
  features: ReleaseFeature[];
  signoff?: string;
}

export const CURRENT_RELEASE: ReleaseNotes = {
  version: "2026-04-07",
  enabled: false,
  title: "What's New 🎉",
  features: [
    {
      heading: "🏋️ Workout Wall & Leaderboard",
      description:
        "A full-page photo wall celebrates your players' hard work, plus a live leaderboard with animated counters to track who's putting in the reps.",
    },
    {
      heading: "🤝 Sponsor Spotlight",
      description:
        "Our sponsors now get a dedicated tile on the Workout Wall — randomly placed each visit to keep things fresh. Thank you to everyone who supports the team!",
    },
    {
      heading: "🎨 Team Design System",
      description: "New athlete-inspired, custom look & feel across the entire app — with light/dark mode support.",
    },
    {
      heading: "📸 Image Optimization",
      description: "Workout photos are auto-compressed for faster loading without losing quality.",
    },
    {
      heading: "⏱️ Reset Accomplishments",
      description: "Player accomplishments have been reset - all players are starting at 0 again.",
    },
  ],
  signoff: "-Coach Matt",
};
