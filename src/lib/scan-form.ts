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

// Coordinate lookup for structured form cell labels
const STRUCTURED_CELL_COORDS: Record<string, { x: number; y: number; isStrike: boolean }> = {
  // Strike zone (solid border cells)
  'TL': { x: -0.27, y:  0.30, isStrike: true  },
  'TC': { x:  0.00, y:  0.30, isStrike: true  },
  'TR': { x:  0.27, y:  0.30, isStrike: true  },
  'ML': { x: -0.27, y:  0.00, isStrike: true  },
  'MC': { x:  0.00, y:  0.00, isStrike: true  },
  'MR': { x:  0.27, y:  0.00, isStrike: true  },
  'BL': { x: -0.27, y: -0.30, isStrike: true  },
  'BC': { x:  0.00, y: -0.30, isStrike: true  },
  'BR': { x:  0.27, y: -0.30, isStrike: true  },
  // Ball regions (dashed border cells)
  'HI-L':  { x: -0.27, y:  0.65, isStrike: false },
  'HI-C':  { x:  0.00, y:  0.65, isStrike: false },
  'HI-R':  { x:  0.27, y:  0.65, isStrike: false },
  'L-HI':  { x: -0.65, y:  0.30, isStrike: false },
  'L-MID': { x: -0.65, y:  0.00, isStrike: false },
  'L-LO':  { x: -0.65, y: -0.30, isStrike: false },
  'R-HI':  { x:  0.65, y:  0.30, isStrike: false },
  'R-MID': { x:  0.65, y:  0.00, isStrike: false },
  'R-LO':  { x:  0.65, y: -0.30, isStrike: false },
  'LO-L':  { x: -0.27, y: -0.65, isStrike: false },
  'LO-C':  { x:  0.00, y: -0.65, isStrike: false },
  'LO-R':  { x:  0.27, y: -0.65, isStrike: false },
};

// Expand structured form tally data into individual pitch records
export function expandStructuredTallies(
  tallies: Record<string, Record<string, number>>
): Array<{ pitchType: string; xLocation: number; yLocation: number; isStrike: boolean }> {
  const pitches: Array<{ pitchType: string; xLocation: number; yLocation: number; isStrike: boolean }> = [];
  for (const [cellLabel, typeCounts] of Object.entries(tallies)) {
    const coords = STRUCTURED_CELL_COORDS[cellLabel];
    if (!coords) continue;
    for (const [pitchType, count] of Object.entries(typeCounts)) {
      for (let i = 0; i < count; i++) {
        pitches.push({ pitchType, xLocation: coords.x, yLocation: coords.y, isStrike: coords.isStrike });
      }
    }
  }
  return pitches;
}

const SCAN_PROMPT = `You are an expert at reading baseball pitch-charting paper forms.
Read this photo of a pitch chart and extract all pitch data.

## Step 1 — Identify the form type

**STRUCTURED form** (new design): Has pre-printed labeled regions with solid and dashed borders.
Zone cells have labels like TL, TC, TR, ML, MC, MR, BL, BC, BR (solid border = strike zone).
Ball regions have labels like HI-L, HI-C, HI-R, L-HI, L-MID, L-LO, R-HI, R-MID, R-LO, LO-L, LO-C, LO-R (dashed border).
Each cell has lines like "1 FB: 3" meaning pitch type 1 was thrown 3 times to that region.

**LEGACY form** (old design): Has a hand-drawn rectangular box with a freehand 3×3 grid.
Coaches write individual pitch-type numbers (1, 2, 3…) scattered inside or outside the box.

---

## If STRUCTURED form

Read each labeled cell. For every "N label: count" entry, record that pitch type was thrown <count> times to that cell.
Return the tally data under "structuredTallies" as a nested object: { "TL": { "1": 3, "2": 1 }, "L-MID": { "1": 2 }, ... }
Leave the "pitches" array empty — the app will expand tallies into individual records.

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
- **CRITICAL — inside vs. outside:** A pitch is inside ONLY if clearly within the box. Numbers touching or crossing the edge = BALL outside. When in doubt, call it outside.
- Outside ball positions: estimate x distance (±0.55 just outside, ±0.70 well outside, ±0.85 extreme) AND y position based on height relative to zone

### Velocity
Capture individual velocities if written next to pitch numbers. Otherwise use max found on form.

---

## Output format

Return ONLY valid JSON with no markdown fencing:
{
  "formType": "structured" | "legacy",
  "pitchCount": <total number of pitches>,
  "strikes": <number of strikes or null>,
  "maxVelocity": <highest velocity or null>,
  "eventType": <"Bullpen" | "Game" | "External" | "Live ABs">,
  "playerName": "<name or empty string>",
  "focus": "<focus text or empty string>",
  "notes": "<combined notes or empty string>",
  "structuredTallies": { "<cellLabel>": { "<pitchType>": <count> } },
  "pitches": [
    {
      "pitchNumber": <1-based>,
      "pitchType": "<digit string>",
      "xLocation": <number>,
      "yLocation": <number>,
      "isStrike": <boolean>,
      "velocity": <number or null>
    }
  ]
}

For structured forms: fill structuredTallies, leave pitches [].
For legacy forms: fill pitches[], leave structuredTallies {}.
If unreadable: return { "error": "Unable to read form" }.
If only totals visible (no pitch locations): return empty pitches and empty structuredTallies.`;

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

  // Structured form: expand tallies into individual pitch records
  if (parsed.formType === 'structured' && parsed.structuredTallies) {
    const expanded = expandStructuredTallies(parsed.structuredTallies as Record<string, Record<string, number>>);
    parsed.pitches = expanded.map((p, i) => ({
      pitchNumber: i + 1,
      pitchType: p.pitchType,
      xLocation: p.xLocation,
      yLocation: p.yLocation,
      isStrike: p.isStrike,
      velocity: null,
    }));
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
