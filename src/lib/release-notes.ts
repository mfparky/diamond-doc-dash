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
  version: "2026-05-06",
  enabled: true,
  title: "What's New 🎉",
  features: [
    {
      heading: "📊 Consistency Score",
      description:
        "Coaches now see a blended Consistency grade for each pitcher — combining strike % stability (60%) with workout regularity (40%), shown as ±pp · days/wk.",
    },
    {
      heading: "🔍 Advanced Coach View",
      description:
        "Toggle the advanced player dashboard from the coach view to dig deeper into trends and metrics — coaches only.",
    },
    {
      heading: "📋 Roster on Mobile Nav",
      description:
        "The mobile bottom nav now has quick access to Roster management instead of Workouts.",
    },
    {
      heading: "📝 Long Workout Descriptions",
      description:
        "Long workout text now truncates cleanly with a 'Read more' modal, so dashboards stay tidy on every screen size.",
    },
    {
      heading: "⚡ Faster App Load",
      description:
        "Secondary routes are now lazy-loaded for a snappier coach experience, plus better error toasts when something fails to load.",
    },
    {
      heading: "🛠️ Bug Fixes & Polish",
      description:
        "Outing form rejects empty submissions, larger touch targets for dugout use, Today/Yesterday quick-pick on dates, and stability improvements across the app.",
    },
  ],
  signoff: "-Coach Matt",
};
