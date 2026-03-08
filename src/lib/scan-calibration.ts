import { ScannedOuting, ScannedPitch } from './scan-form';

export interface ScanExample {
  id: string;
  createdAt: string;
  imageDataUrl: string;       // compressed thumbnail for display
  original: ScannedOuting;    // raw AI output
  correctedPitches: ScannedPitch[];  // user-corrected positions
  isEnabled: boolean;         // include in few-shot prompt
  pitcherName?: string;
}

const STORAGE_KEY = 'scan_calibration_examples';
const MAX_EXAMPLES = 10;

export function getScanExamples(): ScanExample[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Compress an image dataUrl down to ≤600px for cheap localStorage storage */
async function compressForStorage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(dataUrl); // fallback
    img.src = dataUrl;
  });
}

export async function addScanExample(
  imageDataUrl: string,
  original: ScannedOuting,
  pitcherName?: string,
): Promise<ScanExample> {
  const compressed = await compressForStorage(imageDataUrl);
  const example: ScanExample = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    imageDataUrl: compressed,
    original,
    correctedPitches: original.pitches.map(p => ({ ...p })),
    isEnabled: false,
    pitcherName: pitcherName || original.playerName || undefined,
  };

  const examples = getScanExamples();
  examples.unshift(example);
  if (examples.length > MAX_EXAMPLES) examples.splice(MAX_EXAMPLES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(examples));
  } catch {
    // Storage quota exceeded — remove oldest and retry
    examples.splice(MAX_EXAMPLES - 2);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(examples)); } catch { /* give up */ }
  }
  return example;
}

export function updateScanExample(
  id: string,
  updates: Partial<Pick<ScanExample, 'correctedPitches' | 'isEnabled'>>,
): void {
  const examples = getScanExamples();
  const idx = examples.findIndex(e => e.id === id);
  if (idx === -1) return;
  examples[idx] = { ...examples[idx], ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(examples));
  } catch { /* quota */ }
}

export function deleteScanExample(id: string): void {
  const examples = getScanExamples().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(examples));
}

/** How many pitches differ between original and corrected */
export function correctionCount(example: ScanExample): number {
  return example.correctedPitches.filter((cp, i) => {
    const op = example.original.pitches[i];
    if (!op) return true;
    return Math.abs(cp.xLocation - op.xLocation) > 0.01 ||
           Math.abs(cp.yLocation - op.yLocation) > 0.01;
  }).length;
}

function parseDataUrl(dataUrl: string): { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const mediaType = (['image/jpeg', 'image/png', 'image/webp'].includes(mime)
    ? mime : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';
  return { base64, mediaType };
}

/** Build few-shot message pairs to prepend to the Claude API call */
export function buildFewShotMessages(
  examples: ScanExample[],
  maxExamples = 2,
): Array<{ role: 'user' | 'assistant'; content: unknown }> {
  const enabled = examples.filter(e => e.isEnabled && e.correctedPitches.length > 0).slice(0, maxExamples);
  return enabled.flatMap(ex => {
    const { base64, mediaType } = parseDataUrl(ex.imageDataUrl);
    const correctedOuting = { ...ex.original, pitches: ex.correctedPitches };
    return [
      {
        role: 'user' as const,
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract pitch data from this form.' },
        ],
      },
      {
        role: 'assistant' as const,
        content: JSON.stringify(correctedOuting),
      },
    ];
  });
}
