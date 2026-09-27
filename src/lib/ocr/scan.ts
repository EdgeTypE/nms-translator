/**
 * The parts of screenshot scanning that are pure decision-making: where to look
 * in a frame, and which of the lines the OCR found is the dialogue. Nothing here
 * touches a canvas or a worker, so it can be unit tested in Node; the browser
 * side lives in ./index.ts.
 *
 * The colour split is deliberately not expressed as a hue window. Each species
 * writes its alien words in its own colour - green for the Gek, orange for the
 * Vy'keen, and so on - while the English words in the same line stay white, so
 * any fixed hue range tuned on one species breaks on the others. Colour only
 * separates two groups here; the lexicon decides which group is the alien one.
 */

/** An axis-aligned region in pixel coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Average ink colour measured inside a word's bounding box. */
export interface Ink {
  hue: number;
  sat: number;
  lum: number;
}

/** A line of text the OCR found, before it has been read closely. */
export interface FoundLine {
  box: Box;
  /** How many of the line's words the archive recognises. */
  hits: number;
  words: number;
  confidence: number;
}

export interface ScannedWord {
  text: string;
  box: Box;
  ink: Ink;
  /** The word is drawn in a colour rather than in white. */
  chromatic: boolean;
  /** The word was decided to be alien script rather than English. */
  alien: boolean;
}

export interface ScanResult {
  text: string;
  words: ScannedWord[];
  /** Species the alien words belong to, or null when none could be decided. */
  race: string | null;
  /** The region the line was found in, for diagnostics. */
  band: Box;
}

// --- tuning ----------------------------------------------------------------

/** Tesseract is noticeably more accurate on larger glyphs. */
export const OCR_UPSCALE = 2;
/** A located line is grown a little so ascenders are not clipped. */
export const LINE_PAD = 8;
/** Low-confidence words are usually HUD chrome caught at the line's edges. */
export const WORD_MIN_CONFIDENCE = 45;
/** A word is "coloured" above this saturation. */
const CHROMA_MIN = 0.25;
/** Anything dimmer than this is background, not ink. */
const INK_LUM_MIN = 130;
/** Only the bottom of a fullscreen frame is searched, for the dialogue box. */
const WIDE_ASPECT = 16 / 9;
const WIDE_ASPECT_TOLERANCE = 0.15;
const WIDE_MIN_SHORT_EDGE = 1000;
const WIDE_REGION_TOP = 0.55;
const WIDE_REGION_BOTTOM = 0.94;

// --- pixel helpers ---------------------------------------------------------

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Average colour of the lit pixels inside a box, as hue/saturation/luminance. */
export function sampleInk(rgba: Uint8ClampedArray, w: number, box: Box): Ink {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x1 = Math.min(w, box.x + box.w);
  const rows = Math.floor(rgba.length / 4 / w);
  const y1 = Math.min(rows, box.y + box.h);
  for (let y = box.y; y < y1; y++) {
    for (let x = box.x; x < x1; x++) {
      const i = (y * w + x) * 4;
      const pr = rgba[i];
      const pg = rgba[i + 1];
      const pb = rgba[i + 2];
      if (lum(pr, pg, pb) < INK_LUM_MIN) continue;
      r += pr;
      g += pg;
      b += pb;
      n++;
    }
  }
  if (n === 0) return { hue: 0, sat: 0, lum: 0 };
  r /= n;
  g /= n;
  b /= n;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, sat: max === 0 ? 0 : d / max, lum: lum(r, g, b) };
}

/** True when the ink is coloured, which is how the alien words stand out. */
export function isChromatic(ink: Ink): boolean {
  return ink.sat >= CHROMA_MIN;
}

/**
 * Strips the punctuation the OCR leaves attached to a word.
 *
 * "modemik!" and "shmandaerusa," are both in the archive, but not with the
 * comma and the exclamation mark still on, so every lookup has to go through
 * here first. Apostrophes are kept because some alien surface forms carry them.
 */
export function normaliseSurface(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z']/g, '')
    .replace(/^'+|'+$/g, '');
}

/** How many of these words the archive knows, across every species. */
export function lexiconHits(words: string[], index: Map<string, Set<string>>): number {
  let hits = 0;
  for (const word of words) {
    if (index.has(normaliseSurface(word))) hits++;
  }
  return hits;
}

/**
 * Picks the species whose lexicon explains the most alien words.
 *
 * Returns null when nothing matches, so the caller can keep its current
 * selection rather than pretend it detected something.
 */
export function guessRace(
  alienWords: string[],
  index: Map<string, Set<string>>,
  races: readonly string[],
): string | null {
  if (alienWords.length === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const race of races) {
    let score = 0;
    for (const word of alienWords) {
      if (index.get(normaliseSurface(word))?.has(race)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = race;
    }
  }
  return best;
}

/**
 * Picks the line most likely to be the dialogue.
 *
 * Ranking by lexicon support rather than by raw word count is what separates
 * real dialogue from scene detail: these frames are full of specular highlights
 * and HUD chrome that the OCR happily reads as gibberish, but almost none of
 * those words exist in the archive.
 *
 * When no line matches the archive at all - the Autophage frame writes its
 * alien words in white too, so there is nothing to recognise - confidence is the
 * better signal, because the real dialogue is still read far more confidently
 * than the reflections around it.
 */
export function pickDialogueLine(lines: FoundLine[]): FoundLine | null {
  const usable = lines.filter((line) => line.words > 0 && line.box.w > 40);
  if (usable.length === 0) return null;
  const withHits = usable.filter((line) => line.hits > 0);
  if (withHits.length > 0) {
    let best = withHits[0];
    for (const line of withHits) {
      if (line.hits > best.hits) best = line;
      else if (line.hits === best.hits && line.words > best.words) best = line;
    }
    return best;
  }
  let best = usable[0];
  for (const line of usable) {
    if (line.confidence > best.confidence) best = line;
    else if (line.confidence === best.confidence && line.words > best.words) best = line;
  }
  return best;
}

/** The part of a frame worth searching for a dialogue line. */
export function searchRegion(w: number, h: number): Box {
  const aspect = w / h;
  const nearWide = Math.abs(aspect - WIDE_ASPECT) / WIDE_ASPECT <= WIDE_ASPECT_TOLERANCE;
  if (nearWide && Math.min(w, h) >= WIDE_MIN_SHORT_EDGE) {
    return {
      x: 0,
      y: Math.round(h * WIDE_REGION_TOP),
      w,
      h: Math.round(h * (WIDE_REGION_BOTTOM - WIDE_REGION_TOP)),
    };
  }
  return { x: 0, y: 0, w, h };
}
