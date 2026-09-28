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
      const result = translateWithIndex(
        index,
        words,
        index.surfaces[0]!,
        entry.name as never,
        'alien-to-english',
        { dictionary: dict, scope: summariseScope(manifest, words, index) },
      );
      expect(result.unknownTokenCount).toBe(0);
      expect(result.coverage).toBe(100);
    });
  }
});
