/**
 * The badge that tells the two kinds of result apart.
 *
 * A surface can come from two places. If it is also in the dictionary it is
 * something a player can learn and use deliberately. If it is not, the game
 * minted it on the spot while writing the sentence, which is worth saying out
 * loud - otherwise a generated word looks exactly as solid as a real one.
 *
 * Measured: the index is a strict superset of the dictionary for all five
 * species (dictionary-only surfaces = 0), so nothing has to be merged. The
 * dictionary is consulted only to decide the badge.
 */
import { alienData } from '../data';
import type { RaceName } from '../types';

let dictionarySurfaces: Set<string> | null = null;

/** Every surface the dictionary knows, lowercased. */
export function dictionarySurfaceSet(): ReadonlySet<string> {
  if (dictionarySurfaces) return dictionarySurfaces;
  const set = new Set<string>();
  for (const entry of alienData.entries) {
    if (typeof entry.surface === 'string' && entry.surface) {
      set.add(entry.surface.toLowerCase());
    }
  }
  dictionarySurfaces = set;
  return set;
}

/** Surfaces the dictionary holds for one species, lowercased. */
export function dictionarySurfacesFor(race: RaceName): ReadonlySet<string> {
  const set = new Set<string>();
  for (const entry of alienData.entries) {
    if (entry.race === race && typeof entry.surface === 'string' && entry.surface) {
      set.add(entry.surface.toLowerCase());
    }
  }
  return set;
}

export type SourceBadge = 'dictionary' | 'generated';

export const BADGE_LABEL: Record<SourceBadge, string> = {
  dictionary: 'dictionary entry',
  generated: 'dialogue-generated',
};

export const BADGE_TITLE: Record<SourceBadge, string> = {
  dictionary: 'This word is in the dictionary, so it can be learned and reused.',
  generated:
    'Not in the dictionary. The game produced it while writing this sentence, so it may not appear again.',
};

export function badgeFor(
  surface: string,
  dictionary: ReadonlySet<string>,
): SourceBadge {
  return dictionary.has(surface.toLowerCase()) ? 'dictionary' : 'generated';
}
