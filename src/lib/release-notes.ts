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
  version: "2026-04-28b",
  enabled: true,
  title: "What's New 🎉",
  features: [
    {
      heading: "🎯 Catch-Up Workouts",
      description:
        "Coaches can now assign catch-up workouts that only players outside the top 5 on the leaderboard can complete — a fair way to help everyone close the gap.",
    },
    {
      heading: "2️⃣ Double-Point Workouts",
      description:
        "Catch-up workouts can be marked as worth 2x, so each completion counts twice on the leaderboard. Climb faster by putting in the work!",
    },
    {
      heading: "📸 Photo-Required Enforcement",
      description:
        "Workouts that require a photo now show a clear notice when opened and can't be saved without uploading proof.",
    },
    {
      heading: "🕒 Last Updated Indicator",
      description:
        "Each player dashboard now shows when it was last updated, so parents always know how fresh the stats are.",
    },
    {
      heading: "🛠️ Bug Fixes",
      description:
        "General stability improvements and small fixes across the app.",
    },
  ],
  signoff: "-Coach Matt",
};
