/**
 * Translation driven by the reverse word index rather than the dictionary.
 *
 * The index knows every surface the game can print, so it resolves far more of a
 * real dialogue line than the dictionary does (measured: 6,314 surfaces against
 * 1,149 dictionary entries for Gek). The result is shaped like the engine's own
 * TranslationResult so the existing output panel, coverage bar and notices keep
 * working unchanged.
 *
 * Two things the dictionary cannot say are carried alongside:
 *   - whether a word is learnable or only ever generated mid-sentence
 *   - what to suggest when a surface is genuinely not in the language
 */
import type {
  RaceName,
  SegmentStatus,
  TranslationDirection,
  TranslationResult,
} from '../types';
import { applyForm, findAlien, findEnglish, suggestPrefix } from './lookup';
import type { PreparedIndex } from './lookup';
import { notFoundMessage, type ScopeSummary } from './scope';
import type { Suggestion, WordIndexWords, WordForm } from './types';

/**
 * Characters the game itself splits tokens on. Taken from the manifest's
 * tokenSeparators (minus newline, which never survives being split on
 * whitespace), so a comma is punctuation rather than a failed lookup.
 */
const PUNCTUATION = new Set(['!', ',', '.', '/', ':', '<', '?', ';', "'", '(', ')', '[', ']', '-', '"']);

/** Characters that end a token, so an affix ending in one wraps the word. */
const PUNCTUATION_CLOSERS = new Set(['.', ',', '!', '?', ';', ':', ')', ']', '"']);

/** The form that gets printed when the index lists several for one word. */
const PREFERRED_FORM: WordForm = 0;

export interface IndexedSegment {
  source: string;
  output: string;
  status: SegmentStatus;
  alternatives: string[];
  /** Every reading the index holds, with its source badge. */
  readings: Array<{ word: string; form: WordForm; learnable: boolean }>;
  /** learnable once, generated once, for the inline badge. */
  badge: 'dictionary' | 'generated' | null;
  /** Populated only when the surface is not in the language. */
  suggestions: Suggestion[];
}

export interface IndexedTranslation extends TranslationResult {
  segments: IndexedSegment[];
  /** Non-null once the species file is loaded. */
  scope: ScopeSummary | null;
}

/**
 * How much each kind of word counts toward the confidence figure, in tenths.
 *
 * A word is not equally trustworthy just because it resolved. Four cases:
 *
 *   dictionary  10  in the dictionary, so the reading can be checked
 *   generated    8  one definite reading, but the game minted it for this
 *                   sentence and it cannot be looked up or reused
 *   ambiguous    6  several readings, and this is the one that was picked
 *   unknown      0  nothing at all
 *
 * Generated sits above ambiguous on purpose: a green word has a single correct
 * answer that just cannot be verified in the dictionary, while an amber one is
 * a choice between several plausible answers. Both are marked with a dotted
 * underline for the same reason.
 *
 * The English side rarely reaches the ambiguous weight at all. Every word the
 * index lists has one surface per case form, so English-to-alien is ambiguous
 * by construction; it is demoted from a pick-among-several to a finished
 * answer as soon as the surface being printed is the one the dictionary holds
 * for that word. See `fromEnglish`.
 *
 * The values are tenths rather than fractions so the sum is exact and the
 * division is rounded once, instead of accumulating float error across a line.
 */
const CONFIDENCE_TENTHS = {
  dictionary: 10,
  generated: 8,
  ambiguous: 6,
  unknown: 0,
} as const;

function confidenceTenths(segment: IndexedSegment): number {
  if (segment.status === 'unknown') return CONFIDENCE_TENTHS.unknown;
  if (segment.status === 'ambiguous') return CONFIDENCE_TENTHS.ambiguous;
  // A resolved word with no badge would mean the dictionary engine answered,
  // which only happens before the species file lands; treat it as dictionary
  // backed so the number does not swing on the fallback.
  return segment.badge === 'generated' ? CONFIDENCE_TENTHS.generated : CONFIDENCE_TENTHS.dictionary;
}

/**
 * The share of the line that is worth trusting, as a whole percentage.
 *
 * This is a weighted score rather than a plain match ratio: a line of four words
 * with one green and one red reads 70%, not 75%. Punctuation and the spacing
 * between words are not part of the denominator.
 */
function confidencePercent(meaning: IndexedSegment[]): number {
  if (meaning.length === 0) return 0;
  const tenths = meaning.reduce((sum, segment) => sum + confidenceTenths(segment), 0);
  return Math.round((tenths / (meaning.length * 10)) * 100);
}

export interface TranslateOptions {
  dictionary: ReadonlySet<string>;
  /** Hides generated words, which have no learning group. */
  dictionaryOnly?: boolean;
  suggestionLimit?: number;
  scope?: ScopeSummary | null;
}

function isPunctuation(token: string): boolean {
  return token.length > 0 && [...token].every((char) => PUNCTUATION.has(char));
}

/**
 * Separates the punctuation glued to a token from the word itself.
 *
 * The game splits on these characters, but text arriving from a screenshot
 * usually arrives as one run: "zzzqqq," or "(pupkessap". Looking the whole run up
 * would miss, so the word is peeled out and the punctuation put back afterwards.
 */
function splitAffixes(token: string): { prefix: string; core: string; suffix: string } {
  // Trailing first. A leading run like "(...)" must not be mistaken for a
  // leading-only affix: if the whole token is punctuation, core ends up empty
  // and the caller keeps it verbatim.
  let start = 0;
  let end = token.length;
  while (end > start && PUNCTUATION.has(token[end - 1]!)) end--;
  while (start < end && PUNCTUATION.has(token[start]!)) start++;
  return { prefix: token.slice(0, start), core: token.slice(start, end), suffix: token.slice(end) };
}

/** Re-attaches the peeled punctuation around a translated word. */
function withAffix(affix: string, output: string): string {
  // A token like "(pupkessap)" ends in ")" and starts with "(", so the affix is
  // a wrap: put the trailing half back after the word and the leading half
  // before it. Otherwise the affix is a plain prefix and goes in front.
  const leading = PUNCTUATION_CLOSERS.has(affix[affix.length - 1] ?? '')
    ? affix.slice(0, affix.length - 1)
    : '';
  const trailing = leading ? affix.slice(affix.length - 1) : affix;
  return `${leading}${output}${trailing}`;
}

function badgeFor(readings: IndexedSegment['readings']): IndexedSegment['badge'] {
  if (readings.length === 0) return null;
  // Any learnable reading makes the surface dictionary backed; a surface with
  // only generated readings is the generated kind.
  return readings.some((reading) => reading.learnable) ? 'dictionary' : 'generated';
}

/**
 * Picks the reading to print. Lower case is preferred because it is what the
 * game writes inside a sentence, so the output reads naturally; the others are
 * kept as alternatives rather than shown one at a time.
 */
function preferred(forms: WordForm[]): number {
  const at = forms.indexOf(PREFERRED_FORM);
  return at >= 0 ? at : 0;
}

function fromAlien(
  token: string,
  index: PreparedIndex,
  words: WordIndexWords,
  options: TranslateOptions,
  core: string,
  affix: string,
): IndexedSegment {
  const match = findAlien(index, words, core, {
    dictionary: options.dictionary,
    dictionaryOnly: options.dictionaryOnly,
  });

  if (!match) {
    return {
      source: token,
      // The word is echoed back rather than replaced: the panel marks it red, and
      // a placeholder would throw away the text the user needs to see and fix.
      output: token,
      status: 'unknown',
      alternatives: [],
      readings: [],
      badge: null,
      suggestions: suggestPrefix(index, words, core, {
        dictionary: options.dictionary,
        dictionaryOnly: options.dictionaryOnly,
        suggestionLimit: options.suggestionLimit,
      }),
    };
  }

  const readings = match.readings.map((reading) => ({
    word: reading.word,
    form: reading.form,
    learnable: reading.learnable,
  }));
  const at = preferred(readings.map((reading) => reading.form));
  const chosen = readings[at] ?? readings[0];

  return {
    source: token,
    output: `${withAffix(affix, applyForm(chosen.word, chosen.form))}`,
    status: readings.length > 1 ? 'ambiguous' : 'translated',
    alternatives: readings
      .filter((_, i) => i !== at)
      .map((reading) => applyForm(reading.word, reading.form)),
    readings,
    badge: badgeFor(readings),
    suggestions: [],
  };
}

function fromEnglish(
  token: string,
  index: PreparedIndex,
  words: WordIndexWords,
  options: TranslateOptions,
  core: string,
  affix: string,
): IndexedSegment {
  const matches = findEnglish(index, words, core, {
    dictionary: options.dictionary,
    dictionaryOnly: options.dictionaryOnly,
  });

  if (matches.length === 0) {
    return {
      source: token,
      // Echoed back like the alien side: the panel marks it red.
      output: token,
      status: 'unknown',
      alternatives: [],
      readings: [],
      badge: null,
      // The English side has no prefix to walk: the rows are sorted by surface,
      // not by English, so a near miss cannot be narrowed down cheaply.
      suggestions: [],
    };
  }

  const readings = matches.map((match) => {
    const reading = match.readings[0]!;
    return { word: match.surface, form: reading.form, learnable: reading.learnable };
  });
  const at = preferred(readings.map((reading) => reading.form));
  const chosen = readings[at] ?? readings[0];

  // An exact dictionary match: the surface being printed is the one the
  // dictionary holds for this word, so the player can go and learn it and
  // check it there. The index still lists the other case forms of the same
  // word, which is not a choice between meanings, so this is a finished
  // answer rather than a pick among several.
  //
  // Measured across the five species, the preferred reading already lands on
  // the dictionary surface for 1,156 of the 1,158 Gek words the dictionary
  // holds, so the printed line does not change - only its score does. The two
  // that miss are words whose dictionary surface is not among the index
  // candidates at all, so there is nothing better to switch to.
  const exact = chosen.learnable;

  return {
    source: token,
    output: `${withAffix(affix, applyForm(chosen.word, chosen.form))}`,
    // The alternates stay on the segment either way: a non-ambiguous segment
    // still gets an "Alternatives: ..." tooltip, so the other case forms are
    // not thrown away just because the answer is certain.
    status: exact || matches.length <= 1 ? 'translated' : 'ambiguous',
    alternatives: readings
      .filter((_, i) => i !== at)
      .map((reading) => applyForm(reading.word, reading.form)),
    readings,
    badge: badgeFor(readings),
    suggestions: [],
  };
}

/**
 * Splits on whitespace and resolves every token on its own, so one unknown word
 * does not hide the rest of the line.
 *
 * The whitespace runs are kept as separator segments rather than dropped. The
 * panel renders one element per segment back to back, so a dropped space would
 * run the words together - and a standalone comma needs to hug the word before
 * it, which only the original spacing can guarantee.
 */
export function translateWithIndex(
  index: PreparedIndex,
  words: WordIndexWords,
  source: string,
  race: RaceName,
  direction: TranslationDirection,
  options: TranslateOptions,
): IndexedTranslation {
  // Capturing the group keeps the spaces in the list instead of discarding them.
  const tokens = source.split(/(\s+)/).filter((token) => token.length > 0);

  const segments: IndexedSegment[] = tokens.map((token) => {
    if (/^\s+$/.test(token)) {
      return {
        source: token,
        output: token,
        status: 'separator',
        alternatives: [],
        readings: [],
        badge: null,
        suggestions: [],
      } satisfies IndexedSegment;
    }
    if (isPunctuation(token)) {
      return {
        source: token,
        output: token,
        status: 'punctuation',
        alternatives: [],
        readings: [],
        badge: null,
        suggestions: [],
      };
    }
    // Peel the punctuation off first, so "zzzqqq," and "(pupkessap" still look
    // up the word in the middle, then put the punctuation back on the output.
    const { core, prefix, suffix } = splitAffixes(token);
    if (!core) {
      return {
        source: token,
        output: token,
        status: 'punctuation',
        alternatives: [],
        readings: [],
        badge: null,
        suggestions: [],
      };
    }
    const affix = `${prefix}${suffix}`;
    return direction === 'alien-to-english'
      ? fromAlien(token, index, words, options, core, affix)
      : fromEnglish(token, index, words, options, core, affix);
  });

  const meaning = segments.filter(
    (segment) => segment.status !== 'punctuation' && segment.status !== 'separator',
  );
  const matched = meaning.filter((segment) => segment.status === 'translated');
  const unknown = meaning.filter((segment) => segment.status === 'unknown');
  const ambiguous = meaning.filter((segment) => segment.status === 'ambiguous');
  const confidence = confidencePercent(meaning);

  return {
    source,
    // Joined without a separator: the separator segments already carry the
    // original spacing, so adding one here would double every gap.
    output: segments.map((segment) => segment.output).join(''),
    direction,
    race,
    segments,
    sourceTokenCount: meaning.length,
    matchedTokenCount: matched.length + ambiguous.length,
    unknownTokenCount: unknown.length,
    ambiguousTokenCount: ambiguous.length,
    coverage: confidence,
    unknownTokens: unknown.map((segment) => segment.source),
    ambiguousMatches: ambiguous.map((segment) => ({
      source: segment.source,
      // The printed reading is the primary one; the rest are the alternates the
      // phrasebook keeps.
      primary: segment.output,
      status: segment.status,
      alternatives: segment.alternatives,
    })),
    scope: options.scope ?? null,
  };
}

/** The sentence shown when a surface has no reading at all. */
export function missMessage(race: RaceName, result: IndexedTranslation): string | null {
  if (result.unknownTokenCount === 0) return null;
  if (!result.scope) {
    return `${result.unknownTokenCount} token${result.unknownTokenCount === 1 ? '' : 's'} in this line are not in the ${race} word list.`;
  }
  return notFoundMessage(race, result.scope);
}

/** Every suggestion in the result, flattened for a single block. */
export function collectSuggestions(result: IndexedTranslation): Array<{ source: string; suggestion: Suggestion }> {
  const out: Array<{ source: string; suggestion: Suggestion }> = [];
  for (const segment of result.segments) {
    for (const suggestion of segment.suggestions) {
      out.push({ source: segment.source, suggestion });
    }
  }
  return out;
}
