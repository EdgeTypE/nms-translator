import { describe, expect, it } from 'vitest';
import {
  applyForm,
  findAlien,
  findEnglish,
  findRowIndex,
  formatSentence,
  parseRow,
  prepareIndex,
  suggestPrefix,
  translateSentence,
} from './lookup';
import { notFoundMessage, scopeLabel, summariseScope } from './scope';
import { badgeFor, BADGE_LABEL } from './badges';
import type { RaceIndex, WordIndexManifest, WordIndexWords } from './types';

/**
 * A fixture cut from the real files, so the tests assert the shapes and the
 * edge cases the shipped index actually has.
 */
const words = {
  schema: 1,
  count: 8,
  forms: ['lower', 'Capitalized', 'ALL-CAPS'],
  rowFormat: 'surface wordIndex form [wordIndex form ...]',
  words: ['welcome', 'greetings', 'prebuilt', 'built', 'one', 'friend', 'cup', 'zzzzz'],
  source: {
    scope: 'speech-table',
    vocabularySize: 8,
    speechRows: 10,
    totalSourceWords: 8,
    localisationFiles: 0,
    localisationTokens: 0,
    tokenSeparators: ['0x0A', '0x2C'],
    maxTokenBytes: 16,
  },
} as unknown as WordIndexWords;

const race = {
  schema: 1,
  race: 'Gek',
  model: 2,
  markov: 'Region_NO',
  sourceWordCount: 8,
  surfaceCount: 7,
  candidateCount: 9,
  ambiguousSurfaces: 1,
  maxCandidatesPerSurface: 2,
  skipped: { non_ascii: 2, generator_error: 1 },
  // Code point sorted, which is what the binary search depends on.
  // "greetings" (1) and "prebuilt" (2) are deliberately absent, mirroring the 11
  // unrenderable words measured in the real index.
  rows: [
    'aberg 6 0',
    'atlas 0 0  0 2',
    'ekrep 4 0',
    'iluma 5 0',
    'pupkessap 5 0',
    'tui 6 0',
    'zafull 3 0  7 0',
  ],
} as unknown as RaceIndex;

const index = prepareIndex(race, words);
const dictionary = new Set(['iluma', 'pupkessap', 'ekrep']);

const manifest = {
  schema: 1,
  forms: ['lower', 'Capitalized', 'ALL-CAPS'],
  sourceWords: words.source,
  races: [],
  totals: { races: 1, surfaces: 7, candidates: 9, sourceWords: 8 },
  generatedUtc: '2026-09-28T12:23:21Z',
} as unknown as WordIndexManifest;

describe('parseRow', () => {
  it('reads a single candidate', () => {
    expect(parseRow('iluma 3 0')).toEqual([{ wordIndex: 3, form: 0 }]);
  });

  it('reads several candidates in order', () => {
    expect(parseRow('atlas 1 0  1 2')).toEqual([
      { wordIndex: 1, form: 0 },
      { wordIndex: 1, form: 2 },
    ]);
  });

  it('ignores a trailing odd token', () => {
    expect(parseRow('iluma 3')).toEqual([]);
  });

  it('falls back to lower case for an unknown form', () => {
    expect(parseRow('iluma 3 9')).toEqual([{ wordIndex: 3, form: 0 }]);
  });
});

describe('prepareIndex', () => {
  it('keeps the file order in the surface list', () => {
    expect(index.surfaces).toEqual([
      'aberg', 'atlas', 'ekrep', 'iluma', 'pupkessap', 'tui', 'zafull',
    ]);
  });

  it('counts only the words it can actually render', () => {
    // 6 of 8: "greetings" and "prebuilt" never appear.
    expect(index.translatableCount).toBe(6);
  });

  it('builds the English to surface direction', () => {
    expect(findEnglish(index, words, 'friend').map((m) => m.surface)).toEqual([
      'iluma',
      'pupkessap',
    ]);
  });
});

describe('findRowIndex', () => {
  it('finds every surface by binary search', () => {
    for (const surface of index.surfaces) {
      expect(index.surfaces[findRowIndex(index.surfaces, surface)]).toBe(surface);
    }
  });

  it('returns -1 for a surface that is not there', () => {
    expect(findRowIndex(index.surfaces, 'zzzqqq')).toBe(-1);
  });

  it('does not find a prefix', () => {
    expect(findRowIndex(index.surfaces, 'ekre')).toBe(-1);
  });

  it('stays correct on a list long enough to branch', () => {
    const long = Array.from({ length: 6314 }, (_, i) => 'w' + String(i).padStart(5, '0')).sort();
    const target = long[4500];
    expect(target).toBeDefined();
    expect(long[findRowIndex(long, target!)]).toBe(target);
    expect(findRowIndex(long, 'nope')).toBe(-1);
  });
});

describe('findAlien', () => {
  it('resolves a known surface', () => {
    const match = findAlien(index, words, '  PUPKESSAP  ', { dictionary });
    expect(match?.surface).toBe('pupkessap');
    expect(match?.readings[0]?.word).toBe('friend');
  });

  it('returns every candidate, one reading per form', () => {
    const match = findAlien(index, words, 'atlas');
    expect(match?.readings).toEqual([
      { word: 'welcome', form: 0, learnable: false },
      { word: 'welcome', form: 2, learnable: false },
    ]);
  });

  it('badges a dictionary surface as learnable and a generated one as not', () => {
    expect(findAlien(index, words, 'iluma', { dictionary })?.readings[0]?.learnable).toBe(true);
    expect(findAlien(index, words, 'tui', { dictionary })?.readings[0]?.learnable).toBe(false);
  });

  it('hides generated readings when only dictionary words are wanted', () => {
    expect(findAlien(index, words, 'tui', { dictionary, dictionaryOnly: true })).toBeNull();
    expect(findAlien(index, words, 'iluma', { dictionary, dictionaryOnly: true })).not.toBeNull();
  });

  it('returns null for an empty or missing surface', () => {
    expect(findAlien(index, words, '')).toBeNull();
    expect(findAlien(index, words, 'zzzqqq')).toBeNull();
  });
});

describe('findEnglish', () => {
  it('returns every surface for a word', () => {
    expect(findEnglish(index, words, 'cup').map((m) => m.surface)).toEqual(['aberg', 'tui']);
  });

  it('returns nothing for a word with no surface', () => {
    expect(findEnglish(index, words, 'greetings')).toEqual([]);
  });
});

describe('suggestPrefix', () => {
  it('lists the next surfaces sharing a prefix', () => {
    expect(suggestPrefix(index, words, 'ek', { dictionary }).map((s) => s.surface)).toEqual(['ekrep']);
  });

  it('carries the readings along so the UI can show a gloss', () => {
    const [first] = suggestPrefix(index, words, 'il', { dictionary });
    expect(first?.readings[0]?.word).toBe('friend');
  });

  it('refuses to suggest on a one character prefix', () => {
    expect(suggestPrefix(index, words, 'e')).toEqual([]);
  });

  it('returns nothing when no surface shares the prefix', () => {
    expect(suggestPrefix(index, words, 'qq')).toEqual([]);
  });
});

describe('translateSentence', () => {
  it('resolves each token on its own and keeps the order', () => {
    const result = translateSentence(index, words, 'iluma qqqq pupkessap', { dictionary });
    expect(result.tokens.map((t) => t.input)).toEqual(['iluma', 'qqqq', 'pupkessap']);
    expect(result.resolved).toBe(2);
  });

  it('offers suggestions only for the token that missed', () => {
    const result = translateSentence(index, words, 'iluma qqqq pupkessap', { dictionary });
    expect(result.tokens[0]?.suggestions).toEqual([]);
    expect(result.tokens[2]?.suggestions).toEqual([]);
  });

  it('renders a question mark where a token has no reading', () => {
    const result = translateSentence(index, words, 'iluma zzzqqq', { dictionary });
    expect(formatSentence(result)).toBe('friend ?');
  });

  it('collapses runs of whitespace', () => {
    const result = translateSentence(index, words, '  iluma   pupkessap ', { dictionary });
    expect(result.tokens).toHaveLength(2);
  });

  it('is empty for empty input', () => {
    expect(translateSentence(index, words, '   ').tokens).toEqual([]);
  });
});

describe('applyForm', () => {
  it('leaves lower case alone', () => expect(applyForm('friend', 0)).toBe('friend'));
  it('capitalises the first letter', () => expect(applyForm('friend', 1)).toBe('Friend'));
  it('upper-cases everything', () => expect(applyForm('friend', 2)).toBe('FRIEND'));
});

describe('badges', () => {
  it('separates dictionary entries from generated ones', () => {
    expect(badgeFor('iluma', dictionary)).toBe('dictionary');
    expect(badgeFor('TUI', dictionary)).toBe('generated');
  });

  it('names both kinds', () => {
    expect(BADGE_LABEL.dictionary).toBeTruthy();
    expect(BADGE_LABEL.generated).toBeTruthy();
    expect(BADGE_LABEL.dictionary).not.toBe(BADGE_LABEL.generated);
  });
});

describe('scope', () => {
  const summary = summariseScope(manifest, words, index);

  it('reports the usable count rather than the claimed one', () => {
    expect(summary.claimed).toBe(8);
    expect(summary.translatable).toBe(6);
    expect(summary.unrenderable).toBe(2);
  });

  it('is verified for a speech-table source', () => {
    expect(summary.verified).toBe(true);
    expect(scopeLabel(summary)).not.toContain('UNVERIFIED');
  });

  it('flags any other source as unverified', () => {
    const other: WordIndexManifest = {
      ...manifest,
      sourceWords: { ...words.source, scope: 'community' },
    };
    expect(summariseScope(other, words, index).verified).toBe(false);
    expect(scopeLabel(summariseScope(other, words, index))).toContain('UNVERIFIED');
  });

  it('explains a miss instead of guessing', () => {
    const message = notFoundMessage('Gek', summary);
    expect(message).toContain('6');
    expect(message).toContain('proper noun or a typo');
    expect(message).not.toContain('?');
  });
});
