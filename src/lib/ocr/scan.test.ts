import { describe, expect, it } from 'vitest';
import {
  guessRace,
  isChromatic,
  lexiconHits,
  normaliseSurface,
  pickDialogueLine,
  sampleInk,
  searchRegion,
  type Box,
  type FoundLine,
} from './scan';

function blank(width: number, height: number, level = 12): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = level;
    data[i * 4 + 1] = level;
    data[i * 4 + 2] = level + 4;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function put(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  rgb: [number, number, number],
): void {
  const i = (y * w + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function line(
  data: Uint8ClampedArray,
  w: number,
  box: Box,
  rgb: [number, number, number] = [235, 240, 245],
): void {
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (x % 14 < 3) continue;
      put(data, w, x, y, rgb);
    }
  }
}

describe('sampleInk and isChromatic', () => {
  const w = 40;
  const h = 40;

  it('reads a green glyph as chromatic', () => {
    const data = blank(w, h);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) put(data, w, x, y, [120, 216, 120]);
    }
    const ink = sampleInk(data, w, { x: 0, y: 0, w, h });
    expect(ink.hue).toBeGreaterThan(90);
    expect(ink.hue).toBeLessThan(140);
    expect(isChromatic(ink)).toBe(true);
  });

  it('treats any species colour as chromatic, not just green', () => {
    // Orange is what the Vy'keen writes in; a hue window tuned on the Gek would
    // have missed it, which is why no hue is used here.
    const data = blank(w, h);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) put(data, w, x, y, [255, 121, 94]);
    }
    expect(isChromatic(sampleInk(data, w, { x: 0, y: 0, w, h }))).toBe(true);
  });

  it('reads a white glyph as not chromatic', () => {
    const data = blank(w, h);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) put(data, w, x, y, [226, 233, 238]);
    }
    expect(isChromatic(sampleInk(data, w, { x: 0, y: 0, w, h }))).toBe(false);
  });

  it('reports nothing for an empty box', () => {
    const ink = sampleInk(blank(w, h), w, { x: 0, y: 0, w, h });
    expect(ink).toEqual({ hue: 0, sat: 0, lum: 0 });
    expect(isChromatic(ink)).toBe(false);
  });
});

describe('normaliseSurface', () => {
  it('drops the punctuation the OCR leaves on a word', () => {
    expect(normaliseSurface('modemik!')).toBe('modemik');
    expect(normaliseSurface('shmandaerusa,')).toBe('shmandaerusa');
  });

  it('keeps an interior apostrophe', () => {
    expect(normaliseSurface("st'pha")).toBe("st'pha");
  });

  it('trims stray apostrophes and spacing', () => {
    expect(normaliseSurface("  'Efo' ")).toBe('efo');
  });

  it('lowercases', () => {
    expect(normaliseSurface('Ekrep')).toBe('ekrep');
  });
});

describe('lexiconHits', () => {
  const index = new Map<string, Set<string>>([
    ['ekrep', new Set(['Gek'])],
    ['abo', new Set(['Gek'])],
    ['modemik', new Set(['Korvax'])],
  ]);

  it('counts every word the archive knows', () => {
    expect(lexiconHits(['ekrep', 'abo', 'zzz'], index)).toBe(2);
  });

  it('is case insensitive', () => {
    expect(lexiconHits(['Ekrep'], index)).toBe(1);
  });

  it('matches through trailing punctuation', () => {
    // This is the Korvax case: both alien words arrive with punctuation on.
    expect(lexiconHits(['modemik!', 'shmandaerusa,'], index)).toBe(1);
  });

  it('is zero for English words the archive has no surface for', () => {
    expect(lexiconHits(['friend', 'buy', 'do'], index)).toBe(0);
  });
});

describe('guessRace', () => {
  const index = new Map<string, Set<string>>([
    ['ekrep', new Set(['Gek'])],
    ['abo', new Set(['Gek'])],
    ['ria', new Set(['Gek'])],
    ['zor', new Set(["Vy'keen"])],
  ]);
  const races = ['Gek', 'Korvax', "Vy'keen", 'Atlas', 'Autophage'];

  it('picks the species that explains the alien words', () => {
    expect(guessRace(['ekrep', 'abo', 'ria'], index, races)).toBe('Gek');
  });

  it('picks the right species for a different script', () => {
    expect(guessRace(['zor', 'zor'], index, races)).toBe("Vy'keen");
  });

  it('matches alien words that arrived with punctuation', () => {
    const withPunctuation = new Map<string, Set<string>>([
      ['modemik', new Set(['Korvax'])],
      ['shmandaerusa', new Set(['Korvax'])],
    ]);
    expect(guessRace(['modemik!', 'shmandaerusa,'], withPunctuation, races)).toBe('Korvax');
  });

  it('returns null when nothing matches, so the caller keeps its selection', () => {
    expect(guessRace(['qqq', 'zzz'], index, races)).toBeNull();
  });

  it('returns null when there are no alien words at all', () => {
    expect(guessRace([], index, races)).toBeNull();
  });
});

describe('pickDialogueLine', () => {
  const box = (x: number, w: number): Box => ({ x, y: 0, w, h: 20 });

  it('prefers lexicon support over raw word count', () => {
    const lines: FoundLine[] = [
      // A long line of scene gibberish the OCR invented.
      { box: box(0, 900), hits: 0, words: 14, confidence: 61 },
      // A shorter line that is actually dialogue.
      { box: box(0, 500), hits: 4, words: 9, confidence: 55 },
    ];
    expect(pickDialogueLine(lines)).toBe(lines[1]);
  });

  it('falls back to confidence when no line matches the archive', () => {
    // The Autophage case: nothing recognisable, so the line the OCR was most
    // sure about wins over the one with the most invented words.
    const lines: FoundLine[] = [
      { box: box(0, 200), hits: 0, words: 3, confidence: 80 },
      { box: box(0, 700), hits: 0, words: 11, confidence: 40 },
      { box: box(0, 900), hits: 0, words: 6, confidence: 95 },
    ];
    expect(pickDialogueLine(lines)).toBe(lines[2]);
  });

  it('prefers lexicon support even over a more confident line', () => {
    const lines: FoundLine[] = [
      { box: box(0, 700), hits: 0, words: 11, confidence: 95 },
      { box: box(0, 500), hits: 2, words: 5, confidence: 30 },
    ];
    expect(pickDialogueLine(lines)).toBe(lines[1]);
  });

  it('uses word count to break a tie on lexicon support', () => {
    const lines: FoundLine[] = [
      { box: box(0, 500), hits: 3, words: 9, confidence: 90 },
      { box: box(0, 500), hits: 3, words: 4, confidence: 40 },
    ];
    expect(pickDialogueLine(lines)).toBe(lines[0]);
  });

  it('ignores lines with no words or almost no width', () => {
    const lines: FoundLine[] = [
      { box: box(0, 20), hits: 9, words: 0, confidence: 99 },
      { box: box(0, 30), hits: 9, words: 2, confidence: 99 },
      { box: box(0, 500), hits: 1, words: 5, confidence: 20 },
    ];
    expect(pickDialogueLine(lines)).toBe(lines[2]);
  });

  it('returns null when there is nothing to choose from', () => {
    expect(pickDialogueLine([])).toBeNull();
  });
});

describe('searchRegion', () => {
  it('searches only the bottom of a large 16:9 frame', () => {
    const region = searchRegion(1920, 1080);
    expect(region.x).toBe(0);
    expect(region.w).toBe(1920);
    expect(region.y).toBe(Math.round(1080 * 0.55));
    expect(region.h).toBe(Math.round(1080 * (0.94 - 0.55)));
  });

  it('searches the whole image when the frame is small', () => {
    expect(searchRegion(800, 450)).toEqual({ x: 0, y: 0, w: 800, h: 450 });
  });

  it('searches the whole image when the aspect is not near 16:9', () => {
    expect(searchRegion(1400, 1400)).toEqual({ x: 0, y: 0, w: 1400, h: 1400 });
  });

  it('searches the whole image for a tall crop', () => {
    expect(searchRegion(1200, 1600)).toEqual({ x: 0, y: 0, w: 1200, h: 1600 });
  });
});

describe('sampleInk ignores a buffer smaller than its dimensions', () => {
  it('does not read past the end', () => {
    const tiny = new Uint8ClampedArray(64);
    expect(() => sampleInk(tiny, 40, { x: 0, y: 0, w: 40, h: 40 })).not.toThrow();
  });

  it('returns an empty reading', () => {
    expect(sampleInk(new Uint8ClampedArray(64), 40, { x: 0, y: 0, w: 40, h: 40 })).toEqual({
      hue: 0,
      sat: 0,
      lum: 0,
    });
  });
});

// Guards the shape the ink sampler depends on.
describe('blank canvas helper', () => {
  it('sees a coloured line but not a white one', () => {
    const dark = blank(20, 20);
    expect(isChromatic(sampleInk(dark, 20, { x: 0, y: 0, w: 20, h: 20 }))).toBe(false);
    line(dark, 20, { x: 2, y: 5, w: 16, h: 10 }, [120, 216, 120]);
    expect(isChromatic(sampleInk(dark, 20, { x: 0, y: 0, w: 20, h: 20 }))).toBe(true);

    const white = blank(20, 20);
    line(white, 20, { x: 2, y: 5, w: 16, h: 10 });
    expect(isChromatic(sampleInk(white, 20, { x: 0, y: 0, w: 20, h: 20 }))).toBe(false);
  });
});
