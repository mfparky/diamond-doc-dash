import Anthropic from '@anthropic-ai/sdk';

export interface ScannedPitch {
  pitchNumber: number;
  pitchType: string;    // e.g. "FB", "CB", "CH", "SL", "CT", or "?"
  xLocation: number;   // -1 (far inside) to 1 (far outside)
  yLocation: number;   // -1 (low) to 1 (high)
  isStrike: boolean;
  velocity?: number;
}

export interface ScannedOuting {
  pitchCount: number;
  strikes: number | null;
  maxVelocity: number | null;
  eventType: 'Bullpen' | 'Game' | 'External' | 'Practice';
  notes: string;
  pitches: ScannedPitch[];
}

const SCAN_PROMPT = `You are an expert at reading baseball pitch-charting paper forms.
Read this photo of a hand-filled pitch chart (approximately 8×10 inches) and extract all pitch data.

## Form layout
- **"Pitching count for today"** field → pitchCount
- **"Focus for today"** field → notes (first line)
- **"Post bullpen reflection"** field → notes (append after a newline)
- **Strike zone box** with a 3×3 grid inside it (9 cells)
- Pitches OUTSIDE the box are balls and have no grid — estimate their position relative to the box edges

## Pitch markers
Each pitch is written as a number (1, 2, 3, …) corresponding to the pitcher's pitch type slot.
Return that number as a string for pitchType (e.g., "1", "2", "3"). Use "?" only if completely illegible.

## Ball/Strike sequence
The form has a row of letters like: B, S, S, B, S, … — one per pitch in order.
Use this sequence as the ground truth for isStrike (S = true, B = false).
If this row is missing, fall back to whether the pitch number is written inside the zone box.

## Coordinate system (normalized)
The strike zone box is divided into a 3×3 grid. Map each cell center to these coordinates:

         Left    Center   Right
Top:   (-0.67, 0.67)  (0.00, 0.67)  (0.67, 0.67)
Mid:   (-0.67, 0.00)  (0.00, 0.00)  (0.67, 0.00)
Bot:   (-0.67,-0.67)  (0.00,-0.67)  (0.67,-0.67)

- If a pitch number is written on a grid line between two cells, average the two cell centers
- For pitches OUTSIDE the box (balls), estimate position relative to box edges:
  - Just outside = ±1.1 on that axis; well outside = ±1.4; extreme = ±1.7
  - Use the direction the number is written relative to the box (e.g., up-and-away = x:1.2, y:1.2)

## Velocity
If individual pitch velocities are written next to pitch numbers, capture them. Otherwise use the max written anywhere on the form.

Return ONLY valid JSON matching this exact schema with no markdown fencing:
{
  "pitchCount": <total number of pitches>,
  "strikes": <number of strikes or null if not written>,
  "maxVelocity": <highest velocity number found or null>,
  "eventType": <"Bullpen" | "Game" | "External" | "Practice" — infer from context or default to "Bullpen">,
  "notes": "<combine: Focus for today field + Post bullpen reflection field + any other coach comments, separated by newlines — empty string if none>",
  "pitches": [
    {
      "pitchNumber": <1-based sequential number>,
      "pitchType": "<digit as string, e.g. '1' | '2' | '3' | '?'>",
      "xLocation": <number>,
      "yLocation": <number>,
      "isStrike": <true|false>,
      "velocity": <number or null>
    }
  ]
}

If pitch locations are not plotted on the form (only totals are written), return an empty pitches array.
If the image is unreadable, return { "error": "Unable to read form" }.`;

export async function scanPaperForm(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  apiKey: string,
): Promise<ScannedOuting> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const result = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: SCAN_PROMPT },
        ],
      },
    ],
  });

  const textBlock = result.content.find((b) => b.type === 'text');
  let json = (textBlock?.type === 'text' ? textBlock.text : '').trim();
  // Strip any accidental markdown fences
  json = json.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  const parsed = JSON.parse(json);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return parsed as ScannedOuting;
}

const API_KEY_STORAGE = 'anthropic_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}
