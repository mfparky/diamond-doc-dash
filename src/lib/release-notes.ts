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
  version: "2026-08-04",
  enabled: true,
  title: "What's New for Families 🎉",
  features: [
    {
      heading: "🎯 Game Strike % Now Counts Games Only",
      description:
        "Strike percentage on game pages no longer gets watered down by bullpen and practice sessions — game numbers are game numbers, bullpen work is tracked separately.",
    },
    {

      heading: "🎨 Charts You Can Actually Read",
      description:
        "Every graph got a fresh coat of paint with high-contrast, colour-blind-friendly colours — no more squinting at grey-on-grey in the bleachers at 8am.",
    },
    {
      heading: "🌗 Light or Dark, Your Call",
      description:
        "A sun/moon button now lives in the top corner of every page. Bright sun at the diamond? Tap it. Late-night stat scrolling? Tap it back.",
    },
    {
      heading: "⚾ Cleaner Game Pages",
      description:
        "Games now show our team and the opponent as separate totals, plus a game-by-game view of pitch counts and strike % — so you can find your player's outing in seconds.",
    },
    {
      heading: "💪 Workout Wall & Leaderboard Polish",
      description:
        "Photo uploads are faster, long workout notes tuck behind a tidy 'Read more', and the leaderboard totals now hide together when a coach turns them off.",
    },
  ],
  signoff: "-Coach Matt",
};

