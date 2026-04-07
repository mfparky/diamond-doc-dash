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
  enabled: true,
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
      description:
        "Coaches can now apply a custom look & feel across the entire app from the Design System page — with light/dark mode support and a one-click reset.",
    },
    {
      heading: "🔢 Smoother Flip Counter",
      description: "The workout completion counter now flips faster and smoother, with all digits perfectly in sync.",
    },
    {
      heading: "📊 Session Breakdown Reorder",
      description:
        "The workout completion counter now sits above the session breakdown for a cleaner, more intuitive layout.",
    },
    {
      heading: "📸 Image Optimization",
      description: "Workout photos are auto-compressed for faster loading without losing quality.",
    },
  ],
  signoff: "-Coach Matt",
};
