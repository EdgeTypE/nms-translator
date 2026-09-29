export const RACE_NAMES = ['Gek', 'Korvax', "Vy'keen", 'Atlas', 'Autophage'] as const;

export type RaceName = (typeof RACE_NAMES)[number];
export type TranslationDirection = 'alien-to-english' | 'english-to-alien';
export type Category =
  | 'MISC'
  | 'HELP'
  | 'TRADE'
  | 'LORE'
  | 'DIRECTIONS'
  | 'THREAT'
  | 'TECH';

export interface AlienEntry {
  sourceIndex: number;
  id: string;
  key: string;
  english: string;
  group: string;
  race: RaceName;
  raceEnum: string;
  markov: string;
  frequency: number;
  category: Category;
  level: number;
  surface: string;
}

export interface RaceDefinition {
  id: string;
  name: RaceName;
  markov: string;
}

export interface ArchiveSources {
  speechTable: string;
  speechTableSha256: string;
  executable: string;
  executableSha256: string;
  englishLocalisation: string;
}

export interface ArchiveCounts {
  allSpeechEntries: number;
  includedEntries: number;
  localizationEntries: number;
  races: Record<RaceName, number>;
  uniqueSurfaces: number;
  ambiguousRaceSurfacePairs: number;
}

export interface AlienArchive {
  schema: number;
  generator: string;
  generatorVersion: string;
  generatedUtc: string;
  sources: ArchiveSources;
  races: RaceDefinition[];
  counts: ArchiveCounts;
  notes: string[];
  entries: AlienEntry[];
}

export type SegmentStatus = 'translated' | 'unknown' | 'ambiguous' | 'separator' | 'punctuation';

export interface TranslationSegment {
  source: string;
  output: string;
  status: SegmentStatus;
  alternatives: string[];
}

export interface AmbiguousMatch {
  source: string;
  primary: string;
  alternatives: string[];
}

export interface TranslationResult {
  source: string;
  output: string;
  direction: TranslationDirection;
  race: RaceName;
  segments: TranslationSegment[];
  sourceTokenCount: number;
  matchedTokenCount: number;
  unknownTokenCount: number;
  ambiguousTokenCount: number;
  /**
   * How much of the line is worth trusting, as a whole percentage.
   *
   * Two producers fill this and they do not mean quite the same thing. The
   * dictionary engine reports the plain match ratio. The word index reports a
   * weighted score instead, because a word the game generated cannot be checked
   * against the dictionary and an ambiguous word is a pick among several, so
   * neither earns a full point. A word the dictionary does hold earns one, in
   * either direction, even where the index lists more than one surface for it.
   * See word-index/translate.ts.
   */
  coverage: number;
  unknownTokens: string[];
  ambiguousMatches: AmbiguousMatch[];
}

export type ViewId = 'npc' | 'translate' | 'phrasebook';
