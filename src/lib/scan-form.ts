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
Read this photo of a pitch chart and extract all pitch data.

## Step 1 — Identify the form type

**PLOT-AND-LIST form** (new design): Has a zone diagram on the LEFT where the coach writes pitch
SEQUENCE NUMBERS (1, 2, 3…) in the location where the pitch was thrown. On the RIGHT is a
numbered log table with columns for pitch Type (e.g., FB, CB, CH) and Outcome (S/B/W).

**LEGACY form** (old design): Has a hand-drawn rectangular box with a freehand 3×3 grid.
Coaches write pitch-TYPE numbers (1, 2, 3…) scattered inside or outside the box.

---

## If PLOT-AND-LIST form

### Reading the plot (left side)
The form has TWO borders around the zone:
1. A thick solid inner border = the strike zone boundary
2. A dashed outer border = the outer limit of the ball tracking area

**CRITICAL — strike vs ball:**
- Number written INSIDE the solid inner box → STRIKE (isStrike: true)
- Number written BETWEEN the dashed outer and solid inner borders → BALL (isStrike: false)
- Number written OUTSIDE the dashed outer border entirely → BALL (isStrike: false)
- When in doubt, call it a BALL.

### Coordinate system
Full range: x and y each span -1.0 to +1.0 (centered on strike zone).
The strike zone occupies: x ∈ [-0.4, 0.4], y ∈ [-0.45, 0.45].

**Zone cell boundaries** (tiny corner labels TL/TC/TR/ML/MC/MR/BL/BC/BR confirm the cell):
| Cell | x range         | y range          | center         |
|------|-----------------|------------------|----------------|
| TL   | -0.40 to -0.13  |  0.15 to  0.45   | (-0.27,  0.30) |
| TC   | -0.13 to  0.13  |  0.15 to  0.45   | ( 0.00,  0.30) |
| TR   |  0.13 to  0.40  |  0.15 to  0.45   | ( 0.27,  0.30) |
| ML   | -0.40 to -0.13  | -0.15 to  0.15   | (-0.27,  0.00) |
| MC   | -0.13 to  0.13  | -0.15 to  0.15   | ( 0.00,  0.00) |
| MR   |  0.13 to  0.40  | -0.15 to  0.15   | ( 0.27,  0.00) |
| BL   | -0.40 to -0.13  | -0.45 to -0.15   | (-0.27, -0.30) |
| BC   | -0.13 to  0.13  | -0.45 to -0.15   | ( 0.00, -0.30) |
| BR   |  0.13 to  0.40  | -0.45 to -0.15   | ( 0.27, -0.30) |

**Sub-cell positioning:** For each pitch number inside the zone, estimate its position
*within* the cell based on where it is visually written. Use the cell boundary ranges above:
- Near top of cell → y close to upper boundary; near bottom → y close to lower boundary
- Near left of cell → x close to left boundary; near right → x close to right boundary
- Centered in cell → use cell center

Example: pitch written in the top-right corner of TL → approximately x: -0.15, y: 0.43

**Ball area positioning:** For balls (outside solid inner border), estimate based on
direction from zone and visual distance from the zone edge:
- x-axis: ±0.50 just outside zone edge → ±0.70 midway through ball area → ±0.85 near dashed border
- y-axis: same scale vertically
- Match both axes to the pitch's actual visual position in the ball area

The sequential pitch numbers (1, 2, 3…) make each pitch unambiguous — use their exact
visual location, not just which cell they fall in.

### Reading the list (right side)
The list has pre-printed pitch numbers (1–50) with hand-written Type and Outcome columns.
- Type: a short label the coach wrote (e.g., "FB", "CB", "1", "2") — use as pitchType string
- Outcome: S = Strike, B = Ball, W or WP = Wild Pitch (treat as ball, isStrike=false)
- Outcome from the list takes precedence over zone position for isStrike

### Combining
For each pitch number: take xLocation/yLocation from the plot, pitchType/isStrike from the list.
If a pitch is in the list but not found on the plot, use (0.00, 0.00) if isStrike, (0.00, 0.65) if ball.
If a pitch appears on the plot with no list entry, infer isStrike from zone position and pitchType="?".

---

## If LEGACY form

### Form layout
- **"Pitch Count Today"** or **"Pitches:"** field → pitchCount
- **"Name:"** field → playerName
- **"Focus for Today"** or **"Focus:"** field → focus
- **"Questions/Notes"** or **"Notes:"** field → notes
- **"Post Bullpen Reflection"** field → append to notes after a newline

### Pitch markers
Each pitch is a single digit (1, 2, 3…) = pitch type slot.
Letters near the zone (B, S) are the ball/strike sequence — NOT pitch markers.

### Ball/Strike sequence
Row of B/S letters gives ground truth for isStrike. Fall back to inside/outside zone box if missing.

### Coordinate system
Strike zone 3×3 cell centers:
         Left      Center    Right
Top:   (-0.27, 0.30)  (0.00, 0.30)  (0.27, 0.30)
Mid:   (-0.27, 0.00)  (0.00, 0.00)  (0.27, 0.00)
Bot:   (-0.27,-0.30)  (0.00,-0.30)  (0.27,-0.30)

Full range: -1.0 to +1.0. Zone occupies x: -0.4 to 0.4, y: -0.45 to 0.45.
- Numbers on a grid line → average the two adjacent cell centers
- Multiple numbers in one cell → same cell-center coordinates for all
- **CRITICAL:** A pitch is inside ONLY if clearly within the box. Edge/outside = BALL. When in doubt, call it outside.
- Outside: estimate x distance (±0.55 just outside, ±0.70 well outside, ±0.85 extreme) + y position by height

---

## Output format

Return ONLY valid JSON with no markdown fencing:
{
  "formType": "plot-and-list" | "legacy",
  "pitchCount": <total number of pitches>,
  "strikes": <number of strikes or null>,
  "maxVelocity": <highest velocity or null>,
  "eventType": <"Bullpen" | "Game" | "External" | "Live ABs">,
  "playerName": "<name or empty string>",
  "focus": "<focus text or empty string>",
  "notes": "<combined notes or empty string>",
  "pitches": [
    {
      "pitchNumber": <1-based sequential>,
      "pitchType": "<type string, e.g. 'FB', 'CB', '1', '2', or '?'>",
      "xLocation": <number>,
      "yLocation": <number>,
      "isStrike": <boolean>,
      "velocity": <number or null>
    }
  ]
}

If unreadable: return { "error": "Unable to read form" }.
If only totals visible (no pitch locations): return empty pitches array.`;

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

  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const anthropicUrl = isLocalDev
    ? `${window.location.origin}/api/anthropic/v1/messages`
    : 'https://zhhqakxjywbipmeyvlum.supabase.co/functions/v1/anthropic-proxy';

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isLocalDev) {
    fetchHeaders['x-api-key'] = apiKey;
    fetchHeaders['anthropic-version'] = '2023-06-01';
  } else {
    // Supabase Edge Function: pass anon key for auth + API key forwarded server-side
    fetchHeaders['apikey'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoaHFha3hqeXdiaXBtZXl2bHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDgwMzAsImV4cCI6MjA4NDQyNDAzMH0.XPDfMQf60GuYZgnoBh4XLUD1Hc51XYORXuTMPPeN7Cs';
    fetchHeaders['x-anthropic-key'] = apiKey;
  }

  const response = await fetch(anthropicUrl, {
    method: 'POST',
    headers: fetchHeaders,
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
