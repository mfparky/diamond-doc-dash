export interface PitchLocation {
  id: string;
  outingId: string;
  pitcherId: string;
  pitchNumber: number;
  pitchType: number; // 1-5
  xLocation: number; // -1 to 1 (left to right)
  yLocation: number; // -1 to 1 (bottom to top)
  isStrike: boolean;
  createdAt: string;
}

export interface PitchTypeConfig {
  [key: string]: string; // "1" -> "FB", "2" -> "CH", etc.
}

export const DEFAULT_PITCH_TYPES: PitchTypeConfig = {
  "1": "FB",
  "2": "CB",
  "3": "CH",
  "4": "SL",
  "5": "CT"
};

// Pitch type colors for visualization
export const PITCH_TYPE_COLORS: Record<string, string> = {
  "1": "hsl(220, 70%, 55%)", // FB - Blue
  "2": "hsl(280, 70%, 55%)", // CB - Purple
  "3": "hsl(142, 70%, 45%)", // CH - Green
  "4": "hsl(25, 90%, 55%)",  // SL - Orange
  "5": "hsl(0, 70%, 55%)"    // CT - Red
};
