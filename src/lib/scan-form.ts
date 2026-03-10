import { getScanExamples, buildFewShotMessages } from './scan-calibration';

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
  eventType: 'Bullpen' | 'Game' | "External" | "Live ABs";
  focus: string;
  notes: string;
  playerName: string;
  pitches: ScannedPitch[];
}

const SCAN_PROMPT = `You are an expert at reading baseball pitch-charting paper forms.
Read this photo of a hand-filled pitch chart (approximately 8×10 inches) and extract all pitch data.

## Form layout
- **"Pitch Count Today"** field → pitchCount
- **"Name"** field → playerName
- **"Focus for Today"** field → focus (exact text, separate from notes)
- **"Questions/Notes"** field → notes
- **"Post Bullpen Reflection"** field → append to notes after a newline
- **Strike zone box** with a 3×3 grid inside it (9 cells)
- Pitches OUTSIDE the box are balls and have no grid — estimate their position relative to the box edges

## Pitch markers
Each pitch is written as a **single digit number** (1, 2, 3, …) corresponding to the pitcher's pitch type slot.
**Only digits are pitch markers inside the zone box** — any letters (B, S, etc.) visible near the zone are part of the Ball/Strike sequence list and must NOT be treated as pitch locations.
Return that digit as a string for pitchType (e.g., "1", "2", "3"). Use "?" only if completely illegible.

## Ball/Strike sequence
The form has a row of letters like: B, S, S, B, S, … — one per pitch in order.
Use this sequence as the ground truth for isStrike (S = true, B = false).
If this row is missing, fall back to whether the pitch number is written inside the zone box.

## Coordinate system (normalized)
The strike zone box is divided into a 3×3 grid. Map each cell center to these coordinates:

         Left      Center    Right
Top:   (-0.27, 0.30)  (0.00, 0.30)  (0.27, 0.30)
Mid:   (-0.27, 0.00)  (0.00, 0.00)  (0.27, 0.00)
Bot:   (-0.27,-0.30)  (0.00,-0.30)  (0.27,-0.30)

The full coordinate display range is -1.0 to +1.0 on both axes. The strike zone occupies roughly x: -0.4 to 0.4 and y: -0.45 to 0.45. Cell centers above are the centers of the 9 sub-cells within that zone.

- If a pitch number is written on a grid line between two cells, average the two cell centers
- Multiple numbers can be stacked/crowded in the same cell — assign them all the same cell-center coordinates; do not try to sub-divide the cell
- Ignore any numbers or annotations written in the margins outside the zone that are NOT pitch markers (e.g. count tallies, labels like "23 3")
- For pitches OUTSIDE the box (balls), estimate position relative to box edges:
  - Just outside = ±0.55 on that axis; well outside = ±0.70; extreme = ±0.85
  - Use the direction the number is written relative to the box (e.g., up-and-away = x:0.60, y:0.60)

## Velocity
If individual pitch velocities are written next to pitch numbers, capture them. Otherwise use the max written anywhere on the form.

Return ONLY valid JSON matching this exact schema with no markdown fencing:
{
  "pitchCount": <total number of pitches>,
  "strikes": <number of strikes or null if not written>,
  "maxVelocity": <highest velocity number found or null>,
  "eventType": <"Bullpen" | "Game" | "External" | "Live ABs" — infer from context or default to "Bullpen">,
  "playerName": "<name written on the Name field, empty string if not found>",
  "focus": "<exact text from Focus for Today field — empty string if blank>",
  "notes": "<Questions/Notes field + Post Bullpen Reflection field combined, separated by newline — empty string if both blank>",
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

async function compressImage(
  base64: string,
  mediaType: string,
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.src = `data:${mediaType};base64,${base64}`;
  });
}

export async function scanPaperForm(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  apiKey: string,
): Promise<ScannedOuting> {
  const compressed = await compressImage(imageBase64, mediaType);

  const fewShot = buildFewShotMessages(getScanExamples());

  const response = await fetch(`${window.location.origin}/api/anthropic/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        ...fewShot,
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: compressed.mediaType, data: compressed.base64 } },
            { type: 'text', text: SCAN_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  console.log('[scan-form] raw API result:', JSON.stringify(result, null, 2));

  const content = result.content as { type: string; text?: string }[] | undefined;
  if (!content || content.length === 0) {
    throw new Error(`No content in response. stop_reason: ${result.stop_reason ?? 'unknown'}`);
  }

  const textBlock = content.find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error(`No text block in response. Block types: ${content.map(b => b.type).join(', ')}`);
  }

  let json = textBlock.text.trim();
  // Strip any accidental markdown fences
  json = json.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  if (!json) {
    throw new Error('Empty text in API response');
  }

  const parsed = JSON.parse(json);
  console.log('[scan-form] parsed response:', JSON.stringify(parsed, null, 2));

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
