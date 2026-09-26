import { describe, expect, it } from 'vitest';
import { TranslationEngine } from './translator';
import type { AlienArchive, AlienEntry, Category, RaceName } from './types';

const makeEntry = (
  sourceIndex: number,
  english: string,
  surface: string,
  frequency = 1,
  race: RaceName = 'Gek',
  category: Category = 'MISC',
): AlienEntry => ({
  sourceIndex,
  id: english.toUpperCase(),
  key: `TEST_${sourceIndex}`,
  english,
  group: `TEST_${sourceIndex}`,
  race,
  raceEnum: race,
  markov: 'Region_NO',
  frequency,
  category,
  level: 1,
  surface,
});

const fixture: AlienArchive = {
  schema: 2,
  generator: 'test',
  generatorVersion: '2.1.0',
  generatedUtc: '2026-01-01T00:00:00Z',
  sources: {
    speechTable: '',
    speechTableSha256: '',
    executable: '',
    executableSha256: '',
    englishLocalisation: '',
  },
  races: [
    { id: 'Traders', name: 'Gek', markov: 'Region_NO' },
    { id: 'Explorers', name: 'Korvax', markov: 'Region_RU' },
    { id: 'Warriors', name: "Vy'keen", markov: 'Region_CH' },
    { id: 'Atlas', name: 'Atlas', markov: 'Generic' },
    { id: 'Builders', name: 'Autophage', markov: 'Generic' },
  ],
  counts: {
    allSpeechEntries: 8,
    includedEntries: 8,
    localizationEntries: 0,
    races: { Gek: 6, Korvax: 2, "Vy'keen": 0, Atlas: 0, Autophage: 0 },
    uniqueSurfaces: 6,
    ambiguousRaceSurfacePairs: 1,
  },
  notes: [],
  entries: [
    makeEntry(0, 'hello', 'nam', 9),
    makeEntry(1, 'traveller', 'omi', 7),
    makeEntry(2, 'friend', 'pax', 5),
    makeEntry(3, 'ship', 'vex', 4),
    makeEntry(4, 'welcome', 'nam', 8),
    makeEntry(5, 'prepared', "siiu'arvi", 2, 'Korvax'),
    makeEntry(6, 'agent', 'shu', 4),
    makeEntry(7, 'soon', 'shu', 3, 'Korvax'),
  ],
};

const engine = new TranslationEngine(fixture);

describe('TranslationEngine', () => {
  it('preserves punctuation and whitespace', () => {
    const result = engine.translate('Hello, traveller!', 'english-to-alien', 'Gek');
    expect(result.output).toBe('nam, omi!');
    expect(result.matchedTokenCount).toBe(2);
    expect(result.unknownTokenCount).toBe(0);
  });

  it('always emits the lowercase generated surface regardless of English casing', () => {
    const result = engine.translate('HELLO traveller Friend', 'english-to-alien', 'Gek');
    expect(result.output).toBe('nam omi pax');
  });

  it('round-trips surfaces that contain an apostrophe', () => {
    const toAlien = engine.translate('Prepared', 'english-to-alien', 'Korvax');
    expect(toAlien.output).toBe("siiu'arvi");

    const toEnglish = engine.translate("SIIU'ARVI", 'alien-to-english', 'Korvax');
    expect(toEnglish.output).toBe('prepared');
    expect(toEnglish.coverage).toBe(100);
  });

  it('keeps identical surfaces in different race archives isolated', () => {
    const gek = engine.translate('shu', 'alien-to-english', 'Gek');
    const korvax = engine.translate('shu', 'alien-to-english', 'Korvax');

    expect(gek.output).toBe('agent');
    expect(gek.ambiguousTokenCount).toBe(0);
    expect(korvax.output).toBe('soon');
    expect(korvax.ambiguousTokenCount).toBe(0);
  });

  it('reports ambiguous surfaces without discarding alternatives', () => {
    const result = engine.translate('nam', 'alien-to-english', 'Gek');
    expect(result.output).toBe('hello');
    expect(result.ambiguousTokenCount).toBe(1);
    expect(result.ambiguousMatches[0].alternatives).toEqual(['welcome']);
  });

  it('keeps unknown words visible', () => {
    const result = engine.translate('hello unknown', 'english-to-alien', 'Gek');
    expect(result.output).toBe('nam unknown');
    expect(result.unknownTokens).toEqual(['unknown']);
    expect(result.coverage).toBe(50);
  });
});

/**
 * 'suth' is ambiguous on purpose: welcome is rarer, so frequency alone always
 * picks hello. The LORE words around it are unambiguous, so they establish a
 * dominant category and flip the reading.
 */
const contextual: AlienArchive = {
  schema: 2,
  generator: 'test',
  generatorVersion: '2.1.0',
  generatedUtc: '2026-01-01T00:00:00Z',
  sources: {
    speechTable: '',
    speechTableSha256: '',
    executable: '',
    executableSha256: '',
    englishLocalisation: '',
  },
  races: [
    { id: 'Traders', name: 'Gek', markov: 'Region_NO' },
    { id: 'Explorers', name: 'Korvax', markov: 'Region_RU' },
    { id: 'Warriors', name: "Vy'keen", markov: 'Region_CH' },
    { id: 'Atlas', name: 'Atlas', markov: 'Generic' },
    { id: 'Builders', name: 'Autophage', markov: 'Generic' },
  ],
  counts: {
    allSpeechEntries: 6,
    includedEntries: 6,
    localizationEntries: 0,
    races: { Gek: 6, Korvax: 0, "Vy'keen": 0, Atlas: 0, Autophage: 0 },
    uniqueSurfaces: 5,
    ambiguousRaceSurfacePairs: 1,
  },
  notes: [],
  entries: [
    makeEntry(0, 'hello', 'suth', 9, 'Gek', 'HELP'),
    makeEntry(1, 'welcome', 'suth', 3, 'Gek', 'LORE'),
    makeEntry(2, 'ancient', 'oldi', 5, 'Gek', 'LORE'),
    makeEntry(3, 'forgotten', 'ulvo', 4, 'Gek', 'LORE'),
    makeEntry(4, 'help', 'naav', 6, 'Gek', 'HELP'),
    makeEntry(5, 'signal', 'tev', 5, 'Gek', 'HELP'),
  ],
};

const contextualEngine = new TranslationEngine(contextual);

describe('context aware ambiguity', () => {
  it('prefers the alternate whose category the sentence is about', () => {
    // LORE x2 beats HELP x0 from the ambiguous word itself.
    const lore = contextualEngine.translate('suth oldi ulvo', 'alien-to-english', 'Gek');
    expect(lore.output).toBe('welcome ancient forgotten');
    expect(lore.ambiguousTokenCount).toBe(1);
  });

  it('keeps the most frequent meaning when the context agrees with it', () => {
    // HELP x2 dominates, so the frequent reading stands.
    const help = contextualEngine.translate('suth naav tev', 'alien-to-english', 'Gek');
    expect(help.output).toBe('hello help signal');
    expect(help.ambiguousTokenCount).toBe(1);
  });

  it('falls back to frequency when the sentence offers no usable context', () => {
    const alone = contextualEngine.translate('suth', 'alien-to-english', 'Gek');
    expect(alone.output).toBe('hello');
    expect(alone.ambiguousMatches[0].alternatives).toEqual(['welcome']);
  });

  it('never lists the chosen reading among its own alternates', () => {
    const lore = contextualEngine.translate('suth oldi ulvo', 'alien-to-english', 'Gek');
    const match = lore.ambiguousMatches[0];
    expect(match.primary).toBe('welcome');
    expect(match.alternatives).not.toContain(match.primary);
    expect(match.alternatives).toEqual(['hello']);
  });
});
