/**
 * Shapes of the files under public/data/alien-word-index/.
 *
 * They are plain classic scripts that assign onto window.NMS_ALIEN_INDEX rather
 * than ES modules, so they can be dropped in with a <script src> tag and picked
 * up per race without a round trip through the bundler.
 */

/** `"0wn 42 1  91 2"` - a surface then wordIndex/form pairs. */
export type IndexRow = string;

/** lower | Capitalized | ALL-CAPS, in the order the form numbers use. */
export type WordForm = 0 | 1 | 2;

export interface WordIndexManifest {
  schema: number;
  forms: string[];
  sourceWords: {
    scope: string;
    vocabularySize: number;
    speechRows: number;
    totalSourceWords: number;
    localisationFiles: number;
    localisationTokens: number;
    tokenSeparators: string[];
    maxTokenBytes: number;
  };
  races: Array<{
    name: string;
    model: number;
    markov: string;
    /** Site-relative path, e.g. "data/alien-word-index/gek.js". */
    file: string;
    surfaceCount: number;
    candidateCount: number;
    ambiguousSurfaces: number;
    maxCandidatesPerSurface: number;
    skipped: { non_ascii: number; generator_error: number };
  }>;
  totals: { races: number; surfaces: number; candidates: number; sourceWords: number };
  generatedUtc: string;
}

export interface WordIndexWords {
  schema: number;
  count: number;
  forms: string[];
  rowFormat: string;
  words: string[];
  source: WordIndexManifest['sourceWords'];
}

export interface RaceIndex {
  schema: number;
  race: string;
  model: number;
  markov: string;
  sourceWordCount: number;
  surfaceCount: number;
  candidateCount: number;
  ambiguousSurfaces: number;
  maxCandidatesPerSurface: number;
  skipped: { non_ascii: number; generator_error: number };
  rows: string[];
}

export interface WordIndexGlobal {
  manifest?: WordIndexManifest;
  words?: WordIndexWords;
  [race: string]: unknown;
}

/** One English reading of an alien surface. */
export interface WordReading {
  /** The English word, resolved through the shared word list. */
  word: string;
  /** How the token was written on screen: lower, Capitalised, or upper. */
  form: WordForm;
  /**
   * True when the surface also exists in the dictionary, so the word can be
   * learned; false when the game only ever generates it mid-sentence.
   */
  learnable: boolean;
}

export interface AlienMatch {
  surface: string;
  readings: WordReading[];
}

export interface Suggestion {
  surface: string;
  readings: WordReading[];
}

export interface SentenceResult {
  /** One entry per whitespace-separated input token, in order. */
  tokens: Array<{ input: string; match: AlienMatch | null; suggestions: Suggestion[] }>;
  /** How many tokens had at least one reading. */
  resolved: number;
}
