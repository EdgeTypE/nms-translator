/**
 * Browser side of screenshot scanning: decode the upload, let the OCR find the
 * lines, then read the dialogue line closely and decide what language it is in.
 *
 * Tesseract's wasm core and language data are fetched from its CDN the first
 * time a scan runs (about 8 MB, then cached by the browser). The image itself
 * never leaves the page: it is handed to the worker as a blob and read locally.
 */
import {
  guessRace,
  isChromatic,
  lexiconHits,
  LINE_PAD,
  OCR_UPSCALE,
  pickDialogueLine,
  sampleInk,
  searchRegion,
  WORD_MIN_CONFIDENCE,
  type Box,
  type FoundLine,
  type ScanResult,
  type ScannedWord,
} from './scan';
import { translationEngine } from '../data';
import { RACE_NAMES, type RaceName } from '../types';

/** A scan whose species is narrowed to the archive's own union. */
export type ScreenshotScan = Omit<ScanResult, 'race'> & { race: RaceName | null };

/** Surface form -> the species that use it. Built once from the whole archive. */
let raceIndex: Map<string, Set<string>> | null = null;

function getRaceIndex(): Map<string, Set<string>> {
  if (raceIndex) return raceIndex;
  const index = new Map<string, Set<string>>();
  for (const race of RACE_NAMES) {
    for (const entry of translationEngine.getEntries(race)) {
      const surface = entry.surface.toLowerCase();
      const seen = index.get(surface);
      if (seen) seen.add(race);
      else index.set(surface, new Set<string>([race]));
    }
  }
  raceIndex = index;
  return index;
}

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, { logger: () => undefined });
      await worker.setParameters({ preserve_interword_spaces: '1' });
      return worker;
    })().catch((error) => {
      // Let a later attempt retry instead of caching the failure forever.
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export function releaseOcrWorker(): void {
  const pending = workerPromise;
  workerPromise = null;
  void pending?.then((worker) => worker.terminate()).catch(() => undefined);
}

/**
 * Decodes the upload into a canvas.
 *
 * The canvas is kept as the source of truth for cropping: drawImage only
 * accepts a CanvasImageSource, and ImageData is not one, so the pixels are read
 * back separately for the analysis.
 */
async function decodeToCanvas(source: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas 2D is unavailable in this browser.');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function readPixels(canvas: HTMLCanvasElement): ImageData {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Crops a region and upscales it, which is what makes the OCR reliable. */
function cropForOcr(
  source: HTMLCanvasElement,
  box: Box,
  scale: number,
): { blob: Promise<Blob>; scale: number } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(box.w * scale));
  canvas.height = Math.max(1, Math.round(box.h * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
  const blob = new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Could not encode the cropped image.'));
    }, 'image/png');
  });
  return { blob, scale: canvas.width / Math.max(1, box.w) };
}

type TesseractWord = import('tesseract.js').Word;
type TesseractLine = import('tesseract.js').Line;

function collectLines(blocks: unknown): TesseractLine[] {
  const out: TesseractLine[] = [];
  const walk = (node: unknown): void => {
    const block = node as { paragraphs?: unknown[]; blocks?: unknown[] };
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of (paragraph as { lines?: unknown[] }).lines ?? []) {
        out.push(line as TesseractLine);
      }
    }
    for (const child of block.blocks ?? []) walk(child);
  };
  for (const block of (blocks as unknown[]) ?? []) walk(block);
  return out;
}

export async function scanScreenshot(source: Blob): Promise<ScreenshotScan> {
  const canvas = await decodeToCanvas(source);
  const image = readPixels(canvas);
  const index = getRaceIndex();
  const worker = await getWorker();

  // Pass one: hand the whole search region over and let the OCR do its own line
  // segmentation. Its layout analysis is far better at telling text from scene
  // than any brightness rule, so the only judgement left is which of the lines it
  // found is the dialogue - and the archive answers that.
  const region = searchRegion(image.width, image.height);
  const wide = cropForOcr(canvas, region, OCR_UPSCALE);
  const first = await worker.recognize(await wide.blob, {}, { blocks: true, text: false });
  const lines: FoundLine[] = collectLines(first.data.blocks).map((line) => {
    const box = line.bbox;
    const words = (line.words ?? []).map((word) => word.text?.trim() ?? '').filter(Boolean);
    return {
      box: {
        x: region.x + box.x0 / wide.scale,
        y: region.y + box.y0 / wide.scale,
        w: (box.x1 - box.x0) / wide.scale,
        h: (box.y1 - box.y0) / wide.scale,
      },
      hits: lexiconHits(words, index),
      words: words.length,
      confidence: line.confidence ?? 0,
    };
  });

  const chosen = pickDialogueLine(lines);
  if (!chosen) {
    throw new Error('No line of text was found in that image.');
  }

  // Pass two: read just that line, which drops the surrounding scene and gives
  // clean per-word boxes for the colour split.
  const padded: Box = {
    x: Math.max(0, Math.round(chosen.box.x - LINE_PAD)),
    y: Math.max(0, Math.round(chosen.box.y - LINE_PAD)),
    w: Math.min(image.width, Math.round(chosen.box.w + LINE_PAD * 2)),
    h: Math.min(image.height, Math.round(chosen.box.h + LINE_PAD * 2)),
  };
  const tight = cropForOcr(canvas, padded, OCR_UPSCALE);
  const second = await worker.recognize(await tight.blob);

  const words: ScannedWord[] = [];
  for (const word of (second.data.words ?? []) as TesseractWord[]) {
    const text = word.text?.trim();
    if (!text) continue;
    if ((word.confidence ?? 0) < WORD_MIN_CONFIDENCE) continue;
    const b = word.bbox;
    // Boxes come back in the upscaled crop's space; map them onto the frame.
    const box: Box = {
      x: padded.x + b.x0 / tight.scale,
      y: padded.y + b.y0 / tight.scale,
      w: (b.x1 - b.x0) / tight.scale,
      h: (b.y1 - b.y0) / tight.scale,
    };
    const ink = sampleInk(image.data, image.width, box);
    words.push({ text, box, ink, chromatic: isChromatic(ink), alien: false });
  }

  const text = words
    .map((word) => word.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Colour only splits the line in two; which half is the alien script is
  // decided by which half the archive recognises.
  const chromatic = words.filter((word) => word.chromatic);
  const plain = words.filter((word) => !word.chromatic);
  const chromaticHits = lexiconHits(
    chromatic.map((word) => word.text),
    index,
  );
  const plainHits = lexiconHits(
    plain.map((word) => word.text),
    index,
  );
  const alienWords =
    chromatic.length > 0 && (plain.length === 0 || chromaticHits >= plainHits)
      ? chromatic
      : plain;
  for (const word of alienWords) word.alien = true;

  const race = guessRace(
    alienWords.map((word) => word.text),
    index,
    RACE_NAMES,
  ) as RaceName | null;

  return { text, words, race, band: padded };
}
