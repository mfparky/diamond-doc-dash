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
  version: "2026-04-12",
  enabled: false,
  title: "What's New 🎉",
  features: [
    {
      heading: "📸 Bonus Workouts",
      description:
        "Coaches can now assign bonus workouts that require a photo to complete — prove you put in the work!",
    },
    {
      heading: "📅 Workout Wall Date Fix",
      description:
        "Photos on the Workout Wall now show the actual day you completed the workout instead of the start of the week.",
    },
    {
      heading: "🔒 Frequency Limits",
      description:
        "Bonus workouts are now properly capped so you can only log them the number of times assigned per week.",
    },
    {
      heading: "🛠️ Bug Fixes",
      description: "Fixed an issue that prevented some players from having workouts added to their profile.",
    },
  ],
  signoff: "-Coach Matt",
};
