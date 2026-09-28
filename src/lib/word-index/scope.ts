/**
 * Index entries that never reach a surface, and therefore cannot be translated.
 *
 * Measured against the shipped index: 11 of the 2,169 words have no surface in
 * any species file. Ten of them are the glitched spellings (at1αs, blueρrint,
 * stαff ...) that the generator's hash cannot turn into an alien word because it
 * only implements the ASCII path. One, cartographic-entity, is a real generator
 * failure. Saying "this language has 2,169 words" would overstate it, so the
 * count the UI shows is the one that can actually be rendered.
 */
import type { PreparedIndex } from './lookup';
import type { WordIndexManifest, WordIndexWords } from './types';

export interface ScopeSummary {
  /** Words the manifest claims the language holds. */
  claimed: number;
  /** Words this species can actually render. */
  translatable: number;
  /** claimed - translatable. */
  unrenderable: number;
  /** False when the word list did not come from the speech table. */
  verified: boolean;
  /** e.g. "speech-table"; shown as-is so the source is never vague. */
  scope: string;
  generatedUtc: string;
}

export function summariseScope(
  manifest: WordIndexManifest,
  words: WordIndexWords,
  index: PreparedIndex | null,
): ScopeSummary {
  const claimed = words.count || manifest.sourceWords.vocabularySize;
  return {
    claimed,
    translatable: index ? index.translatableCount : 0,
    unrenderable: index ? Math.max(0, claimed - index.translatableCount) : 0,
    verified: manifest.sourceWords.scope === 'speech-table',
    scope: manifest.sourceWords.scope,
    generatedUtc: manifest.generatedUtc,
  };
}

/** The sentence shown when a surface has no reading at all. */
export function notFoundMessage(race: string, scope: ScopeSummary): string {
  const total = scope.translatable;
  const base =
    `The ${race} language holds ${total.toLocaleString('en')} usable word` +
    (total === 1 ? '' : 's') + '. This one is not one of them, so it is most ' +
    'likely a proper noun or a typo.';
  if (scope.unrenderable > 0) {
    return (
      `${base} ${scope.unrenderable} further word` +
      (scope.unrenderable === 1 ? '' : 's') +
      ' in the source list can never be rendered, because the generator only ' +
      'handles plain letters.'
    );
  }
  return base;
}

/** The scope line shown under the results. */
export function scopeLabel(scope: ScopeSummary): string {
  const total = scope.translatable.toLocaleString('en');
  const head = `Word list: ${total} usable word${scope.translatable === 1 ? '' : 's'} (source: ${scope.scope})`;
  return scope.verified
    ? head
    : `${head} - UNVERIFIED, not derived from the speech table`;
}
