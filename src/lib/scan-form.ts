import OpenAI from 'openai';

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
Read this photo of a hand-filled pitch chart and extract all pitch data.

Coordinate system for pitch locations:
- The strike zone is a rectangle on the form
- x axis: -1 = far inside (left edge), 0 = center, 1 = far outside (right edge)
- y axis: -1 = low (bottom edge), 0 = center, 1 = high (top edge)
- Estimate each plotted dot's position within the strike zone box to produce these normalized coordinates
- Pitches outside the strike zone box get x/y values beyond ±0.5 (e.g., high and outside = x:0.8, y:0.8)

Pitch types to recognize (map to these abbreviations):
- Fastball / FB / 4-seam / 2-seam → "FB"
- Curveball / CB / Curve → "CB"
- Changeup / CH / Change → "CH"
- Slider / SL → "SL"
- Cutter / CT / Cut → "CT"
- Unknown or illegible → "?"

isStrike: true if the pitch dot is inside the strike zone box, false if outside.

Return ONLY valid JSON matching this exact schema with no markdown fencing:
{
  "pitchCount": <total number of pitches>,
  "strikes": <number of strikes or null if not written>,
  "maxVelocity": <highest velocity number found or null>,
  "eventType": <"Bullpen" | "Game" | "External" | "Practice" — infer from context or default to "Bullpen">,
  "notes": "<any written notes, focus areas, coach comments — empty string if none>",
  "pitches": [
    {
      "pitchNumber": <1-based sequential number>,
      "pitchType": "<FB|CB|CH|SL|CT|?>",
      "xLocation": <-1.0 to 1.0>,
      "yLocation": <-1.0 to 1.0>,
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
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const result = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: 'text', text: SCAN_PROMPT },
        ],
      },
    ],
  });

  let json = (result.choices[0].message.content ?? '').trim();
  // Strip any accidental markdown fences
  json = json.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  const parsed = JSON.parse(json);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return parsed as ScannedOuting;
}

const API_KEY_STORAGE = 'openai_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}
