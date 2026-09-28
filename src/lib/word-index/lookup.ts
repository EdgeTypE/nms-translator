/**
 * Lookups over the reverse word index.
 *
 * Nothing here touches the DOM, so the whole thing is unit tested against a
 * fixture built from the real files.
 *
 * The rows arrive sorted by code point, and that order is load bearing: the
 * alien-to-English lookup is a plain binary search. localeCompare and the
 * other locale-aware comparators would reorder the list and make the search
 * quietly miss, so every comparison below is an explicit code point compare.
 */
import type {
  AlienMatch,
  RaceIndex,
  SentenceResult,
  Suggestion,
  WordForm,
  WordIndexWords,
  WordReading,
} from './types';

/** One English word a surface can carry, plus how it was written. */
interface Candidate {
  wordIndex: number;
  form: WordForm;
}

/** A race index prepared for searching. */
export interface PreparedIndex {
  race: string;
  /** Row per surface, in the same order. */
  rows: string[];
  /** Surfaces only, code point sorted - the binary search runs on this. */
  surfaces: string[];
  /** surface (lowercase) -> candidates. Mirrors `surfaces` for cheap repeats. */
  bySurface: Map<string, Candidate[]>;
  /** English word (lowercase) -> the surfaces that render it. */
  byWord: Map<string, Array<{ surface: string; form: WordForm }>>;
  /** English word (lowercase) -> its position in the shared word list. */
  wordIndex: Map<string, number>;
  /** How many of the shared words this race can actually render. */
  translatableCount: number;
}

const WORD_FORMS: WordForm[] = [0, 1, 2];

/** `"ekrep 2132 0  40 2"` -> `[[2132, 0], [40, 2]]` */
export function parseRow(row: string): Candidate[] {
  const parts = row.trim().split(/\s+/);
  const out: Candidate[] = [];
  // parts[0] is the surface; the rest are wordIndex/form pairs.
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const wordIndex = Number(parts[i]);
    const form = Number(parts[i + 1]);
    if (!Number.isInteger(wordIndex) || !Number.isInteger(form)) continue;
    // A form the file does not define is treated as plain lower case rather
    // than dropped: the word itself is still a real reading.
    const safeForm = WORD_FORMS.includes(form as WordForm) ? (form as WordForm) : 0;
    out.push({ wordIndex, form: safeForm });
  }
  return out;
}

export function prepareIndex(race: RaceIndex, words: WordIndexWords): PreparedIndex {
  const rows = race.rows;
  const surfaces: string[] = new Array(rows.length);
  const bySurface = new Map<string, Candidate[]>();
  const wordSeen = new Set<number>();

  // The shared list is the only place an English word and its position live, so
  // the reverse direction is built from it rather than stored again per species.
  const wordIndex = new Map<string, number>();
  for (let i = 0; i < words.words.length; i++) {
    const word = words.words[i];
    if (typeof word === 'string' && word) wordIndex.set(word.toLowerCase(), i);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const space = row.indexOf(' ');
    if (space <= 0) continue;
    const surface = row.slice(0, space);
    surfaces[i] = surface;
    const candidates = parseRow(row);
    if (candidates.length > 0) bySurface.set(surface, candidates);
    for (const candidate of candidates) wordSeen.add(candidate.wordIndex);
  }

  // Reverse direction: one pass over the rows builds the whole word -> surface
  // map, which is what the English-to-alien side needs.
  const byWord = new Map<string, Array<{ surface: string; form: WordForm }>>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const space = row.indexOf(' ');
    if (space <= 0) continue;
    const surface = row.slice(0, space);
    for (const candidate of parseRow(row)) {
      const word = words.words[candidate.wordIndex];
      if (typeof word !== 'string' || !word) continue;
      const key = word.toLowerCase();
      const list = byWord.get(key);
      const entry = { surface, form: candidate.form };
      if (list) list.push(entry);
      else byWord.set(key, [entry]);
    }
  }

  return {
    race: race.race,
    rows,
    surfaces,
    bySurface,
    byWord,
    wordIndex,
    translatableCount: wordSeen.size,
  };
}

/** Code point compare. Never localeCompare: the file's order depends on this. */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Binary search. Returns the row index, or -1. */
export function findRowIndex(surfaces: string[], needle: string): number {
  let low = 0;
  let high = surfaces.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = surfaces[mid];
    if (value === undefined) return -1;
    const order = compare(value, needle);
    if (order === 0) return mid;
    if (order < 0) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export interface LookupOptions {
  /** Surfaces present in the dictionary, so results can be badged. */
  dictionary?: ReadonlySet<string>;
  /**
   * Hides generated words, which have no learning group. Used when a group
   * filter is active.
   */
  dictionaryOnly?: boolean;
  /** Prefix suggestions to return when a surface is not found. */
  suggestionLimit?: number;
}

function toReadings(
  candidates: Candidate[],
  words: WordIndexWords,
  surface: string,
  options: LookupOptions,
): WordReading[] {
  const known = options.dictionary?.has(surface) ?? false;
  const readings: WordReading[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const word = words.words[candidate.wordIndex];
    if (word === undefined) continue;
    const learnable = known;
    if (options.dictionaryOnly && !learnable) continue;
    // A surface can reach the same word through more than one form; one reading
    // per word is enough, the form only decides which spelling is shown.
    const key = `${candidate.form}:${word}`;
    if (seen.has(key)) continue;
    seen.add(key);
    readings.push({ word, form: candidate.form, learnable });
  }
  return readings;
}

/** alien -> English. One binary search, no map to build. */
export function findAlien(
  index: PreparedIndex,
  words: WordIndexWords,
  input: string,
  options: LookupOptions = {},
): AlienMatch | null {
  const needle = input.trim().toLowerCase();
  if (!needle) return null;
  const at = findRowIndex(index.surfaces, needle);
  if (at < 0) return null;
  const row = index.rows[at];
  if (row === undefined) return null;
  const surface = row.slice(0, row.indexOf(' '));
  const candidates = index.bySurface.get(surface);
  if (!candidates) return null;
  const readings = toReadings(candidates, words, surface, options);
  return readings.length > 0 ? { surface, readings } : null;
}

/** English -> alien. Reads the map built at load time. */
export function findEnglish(
  index: PreparedIndex,
  words: WordIndexWords,
  input: string,
  options: LookupOptions = {},
): AlienMatch[] {
  const needle = input.trim().toLowerCase();
  if (!needle) return [];
  const entries = index.byWord.get(needle);
  if (!entries) return [];
  const out: AlienMatch[] = [];
  for (const entry of entries) {
    const match = findAlien(index, words, entry.surface, options);
    if (match) out.push(match);
  }
  return out;
}

/**
 * The next few surfaces sharing a prefix, starting from where the binary search
 * stopped. Suggestions only: they are never presented as a translation.
 */
export function suggestPrefix(
  index: PreparedIndex,
  words: WordIndexWords,
  input: string,
  options: LookupOptions = {},
): Suggestion[] {
  const limit = options.suggestionLimit ?? 8;
  const prefix = input.trim().toLowerCase();
  if (prefix.length < 2) return [];

  // Seed with a plain binary search for the insertion point, then walk forward.
  let low = 0;
  let high = index.surfaces.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const value = index.surfaces[mid];
    if (value === undefined || compare(value, prefix) >= 0) high = mid;
    else low = mid + 1;
  }

  const out: Suggestion[] = [];
  for (let i = low; i < index.surfaces.length && out.length < limit; i++) {
    const surface = index.surfaces[i];
    if (surface === undefined || !surface.startsWith(prefix)) break;
    const match = findAlien(index, words, surface, options);
    if (match) out.push({ surface: match.surface, readings: match.readings });
  }
  return out;
}

/**
 * Splits on whitespace and looks up each token on its own, so one unknown word
 * does not hide the rest of the line. Order is preserved and an unresolved token
 * becomes a question mark.
 */
export function translateSentence(
  index: PreparedIndex,
  words: WordIndexWords,
  input: string,
  options: LookupOptions = {},
): SentenceResult {
  const tokens = input.split(/\s+/).filter((token) => token.length > 0);
  let resolved = 0;
  const out = tokens.map((token) => {
    const match = findAlien(index, words, token, options);
    if (match) {
      resolved++;
      return { input: token, match, suggestions: [] };
    }
    return { input: token, match: null, suggestions: suggestPrefix(index, words, token, options) };
  });
  return { tokens: out, resolved };
}

/** Renders a sentence result, substituting a question mark for misses. */
export function formatSentence(result: SentenceResult, withForms = true): string {
  return result.tokens
    .map((token) => {
      if (!token.match) return '?';
      const first = token.match.readings[0];
      if (!first) return '?';
      return withForms ? applyForm(first.word, first.form) : first.word;
    })
    .join(' ');
}

export function applyForm(word: string, form: WordForm): string {
  if (form === 2) return word.toUpperCase();
  if (form === 1) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

export const FORM_LABELS: Record<WordForm, string> = {
  0: 'lower',
  1: 'Capitalised',
  2: 'upper',
};
