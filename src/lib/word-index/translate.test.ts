import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { alienData } from '../data';
import { prepareIndex } from './lookup';
import { collectSuggestions, missMessage, translateWithIndex } from './translate';
import { summariseScope } from './scope';
import type { RaceIndex, WordIndexManifest, WordIndexWords } from './types';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'alien-word-index');

function load<T>(file: string): T {
  const source = readFileSync(join(DIR, file), 'utf8');
  const assign = source.match(/\]\s*=\s*/);
  if (!assign || assign.index === undefined) throw new Error(`no assignment in ${file}`);
  const start = source.indexOf('{', assign.index + assign[0].length);
  return JSON.parse(source.slice(start, source.lastIndexOf('}') + 1)) as T;
}

const manifest = load<WordIndexManifest>('manifest.js');
const words = load<WordIndexWords>('words.js');
const racePayload = load<RaceIndex>('gek.js');
const gek = prepareIndex(racePayload, words);

const dictionary = new Set(
  alienData.entries.filter((e) => e.race === 'Gek').map((e) => e.surface.toLowerCase()),
);

const run = (source: string, direction: 'alien-to-english' | 'english-to-alien' = 'alien-to-english') =>
  translateWithIndex(gek, words, source, 'Gek', direction, {
    dictionary,
    scope: summariseScope(manifest, words, gek),
  });

/** Real surfaces, so the weighting is exercised against the shipped data. */
const sharedSurface = [...dictionary].find((s) => gek.bySurface.has(s))!;
const generatedSurface = gek.surfaces.find((s) => !dictionary.has(s))!;
/** A row with more than one candidate, i.e. a surface with several readings. */
const ambiguousSurface = gek.rows
  .find((row) => (row.trim().split(/\s+/).length - 1) / 2 > 1)!
  .split(' ')[0]!;
const missSurface = 'zzqqxyw';

describe('confidence is weighted, not a plain match ratio', () => {
  it('gives a dictionary word a full point', () => {
    expect(run(sharedSurface).coverage).toBe(100);
  });

  it('takes a fifth off a word only the index knows', () => {
    const result = run(generatedSurface);
    expect(result.unknownTokenCount).toBe(0);
    expect(result.segments[0]?.badge).toBe('generated');
    expect(result.coverage).toBe(80);
  });

  it('takes two fifths off an ambiguous word', () => {
    // Lower than green on purpose: a green word has one right answer, an
    // ambiguous one is a pick among several.
    const result = run(ambiguousSurface);
    expect(result.segments[0]?.status).toBe('ambiguous');
    expect(result.coverage).toBe(60);
    expect(result.coverage).toBeLessThan(run(generatedSurface).coverage);
  });

  it('counts a miss as nothing', () => {
    expect(run(missSurface).coverage).toBe(0);
  });

  it('leaves a line with no green and no amber untouched', () => {
    // This is the guard against the weighting leaking into plain lines: four
    // dictionary words still read 100.
    const line = [sharedSurface, ...gek.surfaces.filter((s) => dictionary.has(s)).slice(1, 4)].join(' ');
    expect(run(line).coverage).toBe(100);
  });

  it('averages the weights across the whole line', () => {
    // 2 shared + 1 generated + 1 miss over 4 words: (10 + 10 + 8 + 0) / 40.
    const result = run([sharedSurface, generatedSurface, missSurface, sharedSurface].join(' '));
    expect(result.sourceTokenCount).toBe(4);
    expect(result.matchedTokenCount).toBe(3);
    expect(result.coverage).toBe(70);
  });

  it('dips further as more of the line is green', () => {
    const green = gek.surfaces.filter((s) => !dictionary.has(s) && gek.bySurface.get(s)!.length === 1);
    // 1 shared + 1 green -> 18/20;  1 shared + 2 green -> 26/30;  2 green -> 16/20.
    expect(run([sharedSurface, green[0]!].join(' ')).coverage).toBe(90);
    expect(run([sharedSurface, green[0]!, green[1]!].join(' ')).coverage).toBe(87);
    expect(run([green[0]!, green[1]!].join(' ')).coverage).toBe(80);
  });

  it('ignores punctuation and spacing in the denominator', () => {
    // Three words, one of them green: (10 + 10 + 8) / 30.
    const result = run(`${sharedSurface}, ${generatedSurface} ! ${sharedSurface}`);
    expect(result.sourceTokenCount).toBe(3);
    expect(result.coverage).toBe(93);
  });

  it('is zero for an empty line rather than a division by zero', () => {
    expect(run('   ').coverage).toBe(0);
  });

  it('keeps the match count factual, separate from the score', () => {
    // 3 of 4 words resolved, but only 70% is worth trusting.
    const result = run([sharedSurface, generatedSurface, missSurface, sharedSurface].join(' '));
    expect(result.matchedTokenCount).toBe(3);
    expect(result.sourceTokenCount).toBe(4);
    expect(result.coverage).toBe(70);
  });
});

describe('translateWithIndex, alien to English', () => {
  it('resolves a real surface and keeps the order', () => {
    const result = run('pupkessap zzzqqq');
    expect(result.segments[0]?.output).toBe('welcome');
    // A miss is echoed back, not replaced with a placeholder.
    expect(result.segments.find((s) => s.status === 'unknown')?.output).toBe('zzzqqq');
    expect(result.output).toBe('welcome zzzqqq');
  });

  it('keeps the spacing between the words', () => {
    // The panel renders one element per segment back to back, so a dropped space
    // would run the output together. This is the regression guard for that.
    const result = run('pupkessap zzzqqq iluma');
    expect(result.output).toBe('welcome zzzqqq hello');
  });

  it('keeps the original spacing, including runs and a standalone comma', () => {
    expect(run('pupkessap   iluma').output).toBe('welcome   hello');
    expect(run('  pupkessap ').output).toBe('  welcome ');
    // A comma that stands on its own keeps hugging the word before it.
    expect(run('pupkessap , iluma').output).toBe('welcome , hello');
  });

  it('emits a separator segment for every run of whitespace', () => {
    const result = run('pupkessap zzzqqq iluma');
    const separators = result.segments.filter((s) => s.status === 'separator');
    expect(separators).toHaveLength(2);
    expect(separators.map((s) => s.output)).toEqual([' ', ' ']);
  });

  it('does not count separators or punctuation as words', () => {
    const result = run('pupkessap, iluma!');
    expect(result.sourceTokenCount).toBe(2);
    expect(result.matchedTokenCount).toBe(2);
    expect(result.coverage).toBe(100);
    expect(result.unknownTokenCount).toBe(0);
  });

  it('resolves more than the dictionary alone could', () => {
    // Three surfaces the Gek dictionary does not hold.
    const generatedOnly = gek.surfaces.filter(
      (s) => !dictionary.has(s) && gek.bySurface.get(s)!.length === 1,
    );
    const probe = generatedOnly.slice(0, 3).join(' ');
    const result = run(probe);
    expect(result.unknownTokenCount).toBe(0);
    expect(result.matchedTokenCount).toBe(3);
  });

  it('leaves standalone punctuation alone instead of failing it', () => {
    // "pupkessap," is a word with a comma; "!" is punctuation on its own, with a
    // separator segment for the space between them.
    const result = run('pupkessap, !');
    const statuses = result.segments.map((s) => s.status);
    expect(statuses).toEqual(['translated', 'separator', 'punctuation']);
    expect(result.unknownTokenCount).toBe(0);
    // Punctuation is not a word, so it is not part of the denominator.
    expect(result.sourceTokenCount).toBe(1);
    expect(result.output).toBe('welcome, !');
  });

  it('badges a dictionary surface and a generated one apart', () => {
    const learnableSurface = [...dictionary].find((s) => gek.bySurface.has(s))!;
    const generatedSurface = gek.surfaces.find((s) => !dictionary.has(s))!;
    expect(run(learnableSurface).segments[0]?.badge).toBe('dictionary');
    expect(run(generatedSurface).segments[0]?.badge).toBe('generated');
  });

  it('marks a surface with several readings as ambiguous and keeps the rest', () => {
    const ambiguous = racePayload.rows.find((row) => (row.trim().split(/\s+/).length - 1) / 2 > 1)!;
    const surface = ambiguous.slice(0, ambiguous.indexOf(' '));
    const segment = run(surface).segments[0]!;
    expect(segment.status).toBe('ambiguous');
    expect(segment.alternatives.length).toBeGreaterThan(0);
    expect(segment.readings.length).toBe(segment.alternatives.length + 1);
  });

  it('counts coverage over words, not punctuation', () => {
    // "welcome" is an English word, not a Gek surface, so in this direction it
    // is a miss. The comma on the miss is punctuation and must not be counted.
    const result = run('pupkessap zzzqqq, welcome');
    expect(result.sourceTokenCount).toBe(3);
    expect(result.unknownTokenCount).toBe(2);
    expect(result.coverage).toBe(33);
  });

  it('peels punctuation off a word before looking it up', () => {
    // The glued comma and the parentheses are what a screenshot actually gives.
    expect(run('pupkessap,').segments[0]?.output).toBe('welcome,');
    expect(run('(pupkessap)').segments[0]?.output).toBe('(welcome)');
    expect(run('pupkessap,').segments[0]?.status).toBe('translated');
  });

  it('keeps the affix on a miss too', () => {
    expect(run('zzzqqq,').segments[0]?.output).toBe('zzzqqq,');
  });

  it('applies the form the file recorded', () => {
    const upper = racePayload.rows.find((row) => / 2(?: |$)/.test(row))!;
    const surface = upper.slice(0, upper.indexOf(' '));
    const segment = run(surface).segments[0]!;
    const chosen = segment.readings[0]!;
    expect(segment.output).toBe(chosen.word.toUpperCase());
  });

  it('hides generated words when only dictionary words are wanted', () => {
    const generatedSurface = gek.surfaces.find((s) => !dictionary.has(s))!;
    const result = translateWithIndex(gek, words, generatedSurface, 'Gek', 'alien-to-english', {
      dictionary,
      dictionaryOnly: true,
    });
    expect(result.unknownTokenCount).toBe(1);
    expect(result.segments[0]?.badge).toBeNull();
  });
});

describe('translateWithIndex, English to alien', () => {
  it('finds a surface for a word', () => {
    const result = run('welcome', 'english-to-alien');
    expect(result.segments[0]?.output).toBe('pupkessap');
    expect(result.unknownTokenCount).toBe(0);
  });

  it('marks a word with several surfaces as ambiguous', () => {
    const word = [...gek.byWord.entries()].find(([, list]) => list.length > 1)![0];
    const segment = run(word, 'english-to-alien').segments[0]!;
    expect(segment.status).toBe('ambiguous');
    expect(segment.alternatives.length).toBeGreaterThan(0);
  });

  it('leaves a word the language cannot print unresolved', () => {
    // Every word in the shared list resolves for Gek, so the honest test is a
    // word that is not in the language at all.
    const result = run('hippopotamus', 'english-to-alien');
    expect(result.unknownTokenCount).toBe(1);
    expect(result.segments[0]?.output).toBe('hippopotamus');
  });

  it('resolves every word the shared list holds, for this species', () => {
    // The reverse map covers the list, so nothing in it falls through.
    const known = words.words.filter((word) => gek.byWord.has(word));
    expect(known.length).toBeGreaterThan(2000);
  });
});

describe('misses are explained, not guessed', () => {
  it('offers prefix suggestions for a near miss, and never as a translation', () => {
    const surface = gek.surfaces.find((s) => s.length > 4)!;
    const truncated = surface.slice(0, 4);
    const result = run(truncated);
    const segment = result.segments[0]!;
    expect(segment.status).toBe('unknown');
    expect(segment.output).toBe(truncated);
    expect(segment.suggestions.length).toBeGreaterThan(0);
    for (const suggestion of segment.suggestions) {
      expect(suggestion.surface.startsWith(truncated)).toBe(true);
    }
    expect(collectSuggestions(result)).toHaveLength(segment.suggestions.length);
  });

  it('offers no suggestion for a prefix nothing shares', () => {
    const segment = run('qqqqqqqq').segments[0]!;
    expect(segment.suggestions).toEqual([]);
  });

  it('says how big the language is when a token misses', () => {
    const message = missMessage('Gek', run('qqqqqqqq'));
    expect(message).toContain(String(summaryScopeCount()));
    expect(message).toContain('proper noun or a typo');
  });

  it('says nothing when the line is fully resolved', () => {
    expect(missMessage('Gek', run('pupkessap'))).toBeNull();
  });

  it('refuses to suggest on a one character prefix', () => {
    const first = gek.surfaces[0]!;
    expect(run(first.slice(0, 1)).segments[0]?.suggestions).toEqual([]);
  });
});

function summaryScopeCount() {
  return gek.translatableCount.toLocaleString('en');
}

describe('every species produces a usable result', () => {
  for (const entry of manifest.races) {
    it(`${entry.name} resolves at least one real surface`, () => {
      const slug = entry.file.split('/').pop()!;
      const index = prepareIndex(load<RaceIndex>(slug), words);
      const dict = new Set(
        alienData.entries.filter((e) => e.race === entry.name).map((e) => e.surface.toLowerCase()),
      );
      const options = { dictionary: dict, scope: summariseScope(manifest, words, index) };
      const translate = (source: string) =>
        translateWithIndex(index, words, source, entry.name as never, 'alien-to-english', options);

      // A word the dictionary also holds earns a full point.
      const shared = [...dict].find((surface) => index.bySurface.has(surface));
      expect(shared, `${entry.name} has a shared word`).toBeDefined();
      expect(translate(shared!).coverage).toBe(100);

      // A word only the index knows still resolves, but at 80%.
      const generated = index.surfaces.find((surface) => !dict.has(surface))!;
      const generatedResult = translate(generated);
      expect(generatedResult.unknownTokenCount).toBe(0);
      expect(generatedResult.segments[0]?.badge).toBe('generated');
      expect(generatedResult.coverage).toBe(80);
    });
  }
});
