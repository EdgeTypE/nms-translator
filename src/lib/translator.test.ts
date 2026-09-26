import { describe, expect, it } from 'vitest';
import { TranslationEngine } from './translator';
import type { AlienArchive, AlienEntry, RaceName } from './types';

const makeEntry = (
  sourceIndex: number,
  english: string,
  surface: string,
  frequency = 1,
  race: RaceName = 'Gek',
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
  category: 'MISC',
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
