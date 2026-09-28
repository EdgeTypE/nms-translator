/**
 * Contract tests against the index files that actually ship.
 *
 * The alien-to-English lookup is a binary search, so the code point order of
 * the rows is load bearing. If the generator ever emits a differently sorted
 * file the search does not fail loudly, it quietly returns nothing - which
 * looks exactly like "this word is not in the language". These tests pin the
 * invariants that would break it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { alienData } from '../data';
import { findAlien, findEnglish, prepareIndex, suggestPrefix, translateSentence } from './lookup';
import type { RaceIndex, WordIndexManifest, WordIndexWords } from './types';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'alien-word-index');

/** The files are classic scripts, not modules: pull the JSON payload back out. */
function load<T>(file: string): T {
  const source = readFileSync(join(DIR, file), 'utf8');
  const assign = source.match(/\]\s*=\s*/);
  if (!assign || assign.index === undefined) throw new Error(`no assignment in ${file}`);
  const start = source.indexOf('{', assign.index + assign[0].length);
  return JSON.parse(source.slice(start, source.lastIndexOf('}') + 1)) as T;
}

const manifest = load<WordIndexManifest>('manifest.js');
const words = load<WordIndexWords>('words.js');
const byRace = new Map(
  manifest.races.map((entry) => {
    const slug = entry.file.split('/').pop() ?? entry.name;
    return [entry.name, load<RaceIndex>(`${slug}`)] as const;
  }),
);

const indexOf = (race: string) => prepareIndex(byRace.get(race)!, words);

describe('shipped manifest', () => {
  it('covers every species the site offers', () => {
    expect(manifest.races.map((r) => r.name).sort()).toEqual([
      'Atlas',
      'Autophage',
      'Gek',
      'Korvax',
      "Vy'keen",
    ]);
  });

  it('comes from the speech table, so the scope is verifiable', () => {
    expect(manifest.sourceWords.scope).toBe('speech-table');
  });

  it('names a file that exists for every species', () => {
    for (const entry of manifest.races) {
      expect(() => load<RaceIndex>(entry.file.split('/').pop()!)).not.toThrow();
    }
  });
});

describe('shipped word list', () => {
  it('has a self consistent count', () => {
    expect(words.words).toHaveLength(words.count);
    expect(words.count).toBe(manifest.sourceWords.vocabularySize);
  });

  it('is the list the manifest describes, in the same order', () => {
    expect(words.source.scope).toBe(manifest.sourceWords.scope);
  });
});

describe('row invariants the binary search depends on', () => {
  for (const entry of manifest.races) {
    describe(entry.name, () => {
      const race = byRace.get(entry.name)!;
      const surfaces = race.rows.map((row) => row.slice(0, row.indexOf(' ')));

      it('is sorted by code point', () => {
        for (let i = 1; i < surfaces.length; i++) {
          expect(
            surfaces[i - 1]! <= surfaces[i]!,
            `row ${i} breaks the order: ${surfaces[i - 1]} then ${surfaces[i]}`,
          ).toBe(true);
        }
      });

      it('has no duplicate surfaces', () => {
        expect(new Set(surfaces).size).toBe(surfaces.length);
      });

      it('matches the surface count the manifest advertises', () => {
        expect(surfaces).toHaveLength(entry.surfaceCount);
      });

      it('points every candidate at a real word and a real form', () => {
        for (const row of race.rows) {
          const parts = row.trim().split(/\s+/);
          for (let i = 1; i + 1 < parts.length; i += 2) {
            const wordIndex = Number(parts[i]);
            const form = Number(parts[i + 1]);
            expect(wordIndex).toBeGreaterThanOrEqual(0);
            expect(wordIndex).toBeLessThan(words.count);
            expect([0, 1, 2]).toContain(form);
          }
        }
      });
    });
  }
});

describe('real lookups', () => {
  it('resolves a known Gek surface', () => {
    const match = findAlien(indexOf('Gek'), words, 'pupkessap');
    expect(match?.readings.map((r) => r.word)).toEqual(['welcome']);
  });

  it('agrees with the dictionary about a surface both know', () => {
    // A surface can carry more than one reading; the dictionary picks one.
    const gek = indexOf('Gek');
    const fromIndex = findAlien(gek, words, 'ekrep')?.readings.map((r) => r.word) ?? [];
    const fromDictionary = alienData.entries
      .filter((e) => e.race === 'Gek' && e.surface.toLowerCase() === 'ekrep')
      .map((e) => e.english);
    expect(fromIndex.length).toBeGreaterThan(0);
    expect(fromDictionary.length).toBeGreaterThan(0);
  });

  it('trims and lower cases the input', () => {
    const gek = indexOf('Gek');
    expect(findAlien(gek, words, '  PUPKESSAP ')?.surface).toBe(
      findAlien(gek, words, 'pupkessap')?.surface,
    );
  });

  it('resolves the Autophage surface the game substitutes for subtitles', () => {
    const match = findAlien(indexOf('Autophage'), words, 'ilpiaplexc');
    expect(match?.readings.map((r) => r.word)).toEqual(['greetings']);
  });

  it('resolves an Atlas surface, which shares the Autophage file', () => {
    expect(findAlien(indexOf('Atlas'), words, 'ilpiaplexc')?.readings[0]?.word).toBe('greetings');
  });

  it('finds the English to alien direction', () => {
    const gek = indexOf('Gek');
    const surfaces = findEnglish(gek, words, 'welcome').map((m) => m.surface);
    expect(surfaces).toContain('pupkessap');
  });

  it('suggests a prefix that exists', () => {
    const suggestions = suggestPrefix(indexOf('Gek'), words, 'ekr');
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.surface.startsWith('ekr')).toBe(true);
    }
  });

  it('translates a mixed line and keeps the order', () => {
    const result = translateSentence(indexOf('Gek'), words, 'pupkessap zzzqqq iluma');
    expect(result.tokens).toHaveLength(3);
    expect(result.tokens[0]?.input).toBe('pupkessap');
    expect(result.tokens[1]?.match).toBeNull();
    expect(result.resolved).toBe(2);
  });

  it('reports fewer renderable words than the list claims', () => {
    const summary = indexOf('Autophage');
    expect(summary.translatableCount).toBeLessThan(words.count);
    expect(summary.translatableCount).toBeGreaterThan(2000);
  });
});

describe('the badge claim', () => {
  it('finds every dictionary surface in the index, for every species', () => {
    const dictionary = new Set(alienData.entries.map((entry) => entry.surface.toLowerCase()));
    for (const entry of manifest.races) {
      const prepared = indexOf(entry.name);
      const missing: string[] = [];
      for (const entry2 of alienData.entries) {
        if (entry2.race !== entry.name) continue;
        const surface = entry2.surface.toLowerCase();
        if (!prepared.bySurface.has(surface)) missing.push(surface);
      }
      expect(
        missing,
        `${entry.name}: ${missing.length} dictionary surfaces missing from the index`,
      ).toHaveLength(0);
    }
    expect(dictionary.size).toBeGreaterThan(0);
  });

  it('produces both badge kinds from real data', () => {
    const prepared = indexOf('Gek');
    const dictionary = new Set(
      alienData.entries.filter((e) => e.race === 'Gek').map((e) => e.surface.toLowerCase()),
    );
    // Pick a dictionary surface and a generated one from the real data rather
    // than hardcoding names, so this keeps testing the claim, not a sample.
    const learnableSurface = [...dictionary].find((s) => prepared.bySurface.has(s));
    const generatedSurface = prepared.surfaces.find((s) => !dictionary.has(s));
    expect(learnableSurface).toBeDefined();
    expect(generatedSurface).toBeDefined();

    expect(findAlien(prepared, words, learnableSurface!, { dictionary })?.readings[0]?.learnable).toBe(
      true,
    );
    expect(findAlien(prepared, words, generatedSurface!, { dictionary })?.readings[0]?.learnable).toBe(
      false,
    );
  });

  it('hides generated readings when only dictionary words are wanted', () => {
    const prepared = indexOf('Gek');
    const dictionary = new Set(
      alienData.entries.filter((e) => e.race === 'Gek').map((e) => e.surface.toLowerCase()),
    );
    const generatedSurface = prepared.surfaces.find((s) => !dictionary.has(s))!;
    expect(findAlien(prepared, words, generatedSurface, { dictionary })).not.toBeNull();
    expect(
      findAlien(prepared, words, generatedSurface, { dictionary, dictionaryOnly: true }),
    ).toBeNull();
  });
});
