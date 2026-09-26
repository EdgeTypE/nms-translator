import type {
  AlienArchive,
  AlienEntry,
  RaceName,
  TranslationDirection,
  TranslationResult,
  TranslationSegment,
} from './types';

const TOKEN_PATTERN = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*|\s+|[^\s\p{L}\p{M}]+/gu;

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en');

const isWord = (value: string) => /[\p{L}\p{M}]/u.test(value);
const isWhitespace = (value: string) => /^\s+$/u.test(value);

const entryPriority = (entry: AlienEntry) => {
  const frequency = Number.isFinite(entry.frequency) ? entry.frequency : 0;
  return [frequency, -entry.sourceIndex] as const;
};

const sortEntries = (entries: AlienEntry[]) => [...entries].sort((a, b) => {
  const priority = entryPriority(a);
  const otherPriority = entryPriority(b);
  return otherPriority[0] - priority[0] || otherPriority[1] - priority[1];
});

const uniqueEntries = (entries: AlienEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.id}:${entry.sourceIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniqueStrings = (values: string[]) => [...new Set(values.filter(Boolean))];

export class TranslationEngine {
  private readonly entriesByRace = new Map<RaceName, AlienEntry[]>();
  private readonly englishIndexes = new Map<RaceName, Map<string, AlienEntry[]>>();
  private readonly surfaceIndexes = new Map<RaceName, Map<string, AlienEntry[]>>();

  constructor(private readonly archive: AlienArchive) {
    const englishIndexes = new Map<RaceName, Map<string, AlienEntry[]>>();
    const surfaceIndexes = new Map<RaceName, Map<string, AlienEntry[]>>();

    for (const race of archive.races) {
      const entries = archive.entries.filter((entry) => entry.race === race.name);
      const english = new Map<string, AlienEntry[]>();
      const surfaces = new Map<string, AlienEntry[]>();

      for (const entry of entries) {
        const englishKey = normalize(entry.english);
        english.set(englishKey, [...(english.get(englishKey) ?? []), entry]);

        const surfaceKey = normalize(entry.surface);
        surfaces.set(surfaceKey, [...(surfaces.get(surfaceKey) ?? []), entry]);
      }

      this.entriesByRace.set(race.name, entries);
      englishIndexes.set(race.name, english);
      surfaceIndexes.set(race.name, surfaces);
    }

    this.englishIndexes = englishIndexes;
    this.surfaceIndexes = surfaceIndexes;
  }

  getEntries(race: RaceName) {
    return this.entriesByRace.get(race) ?? [];
  }

  getRaceCount(race: RaceName) {
    return this.getEntries(race).length;
  }

  translate(
    source: string,
    direction: TranslationDirection,
    race: RaceName,
  ): TranslationResult {
    if (direction === 'english-to-alien') {
      return this.translateToAlien(source, race);
    }
    return this.translateToEnglish(source, race);
  }

  private translateToAlien(source: string, race: RaceName): TranslationResult {
    const index = this.englishIndexes.get(race) ?? new Map<string, AlienEntry[]>();
    const segments: TranslationSegment[] = [];
    const unknownTokens: string[] = [];
    const ambiguousMatches: TranslationResult['ambiguousMatches'] = [];
    let sourceTokenCount = 0;
    let matchedTokenCount = 0;
    let ambiguousTokenCount = 0;

    for (const token of source.match(TOKEN_PATTERN) ?? []) {
      if (isWhitespace(token)) {
        segments.push({ source: token, output: token, status: 'separator', alternatives: [] });
        continue;
      }

      if (!isWord(token)) {
        segments.push({ source: token, output: token, status: 'punctuation', alternatives: [] });
        continue;
      }

      sourceTokenCount += 1;
      const matches = uniqueEntries(index.get(normalize(token)) ?? []);
      if (matches.length === 0) {
        unknownTokens.push(token);
        segments.push({ source: token, output: token, status: 'unknown', alternatives: [] });
        continue;
      }

      const primary = sortEntries(matches)[0];
      const output = primary.surface;
      const alternatives = uniqueStrings(
        sortEntries(matches.slice(1)).map((entry) => entry.surface),
      );
      const isAmbiguous = alternatives.length > 0;
      if (isAmbiguous) {
        ambiguousTokenCount += 1;
        ambiguousMatches.push({ source: token, primary: output, alternatives });
      }

      matchedTokenCount += 1;
      segments.push({
        source: token,
        output,
        status: isAmbiguous ? 'ambiguous' : 'translated',
        alternatives,
      });
    }

    return this.createResult(source, race, 'english-to-alien', segments, {
      sourceTokenCount,
      matchedTokenCount,
      unknownTokens,
      ambiguousMatches,
      ambiguousTokenCount,
    });
  }

  private translateToEnglish(source: string, race: RaceName): TranslationResult {
    const index = this.surfaceIndexes.get(race) ?? new Map<string, AlienEntry[]>();
    const segments: TranslationSegment[] = [];
    const unknownTokens: string[] = [];
    const ambiguousMatches: TranslationResult['ambiguousMatches'] = [];
    let sourceTokenCount = 0;
    let matchedTokenCount = 0;
    let ambiguousTokenCount = 0;

    for (const token of source.match(TOKEN_PATTERN) ?? []) {
      if (isWhitespace(token)) {
        segments.push({ source: token, output: token, status: 'separator', alternatives: [] });
        continue;
      }

      if (!isWord(token)) {
        segments.push({ source: token, output: token, status: 'punctuation', alternatives: [] });
        continue;
      }

      sourceTokenCount += 1;
      const matches = uniqueEntries(index.get(normalize(token)) ?? []);
      if (matches.length === 0) {
        unknownTokens.push(token);
        segments.push({ source: token, output: token, status: 'unknown', alternatives: [] });
        continue;
      }

      const sorted = sortEntries(matches);
      const primary = sorted[0];
      const alternatives = uniqueStrings(sorted.slice(1).map((entry) => entry.english));
      const isAmbiguous = alternatives.length > 0;
      if (isAmbiguous) {
        ambiguousTokenCount += 1;
        ambiguousMatches.push({ source: token, primary: primary.english, alternatives });
      }

      matchedTokenCount += 1;
      segments.push({
        source: token,
        output: primary.english,
        status: isAmbiguous ? 'ambiguous' : 'translated',
        alternatives,
      });
    }

    return this.createResult(source, race, 'alien-to-english', segments, {
      sourceTokenCount,
      matchedTokenCount,
      unknownTokens,
      ambiguousMatches,
      ambiguousTokenCount,
    });
  }

  private createResult(
    source: string,
    race: RaceName,
    direction: TranslationDirection,
    segments: TranslationSegment[],
    summary: {
      sourceTokenCount: number;
      matchedTokenCount: number;
      unknownTokens: string[];
      ambiguousMatches: TranslationResult['ambiguousMatches'];
      ambiguousTokenCount: number;
    },
  ): TranslationResult {
    return {
      source,
      output: segments.map((segment) => segment.output).join(''),
      direction,
      race,
      segments,
      sourceTokenCount: summary.sourceTokenCount,
      matchedTokenCount: summary.matchedTokenCount,
      unknownTokenCount: summary.unknownTokens.length,
      ambiguousTokenCount: summary.ambiguousTokenCount,
      coverage: summary.sourceTokenCount === 0
        ? 0
        : Math.round((summary.matchedTokenCount / summary.sourceTokenCount) * 100),
      unknownTokens: uniqueStrings(summary.unknownTokens),
      ambiguousMatches: summary.ambiguousMatches,
    };
  }
}
