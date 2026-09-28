import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { alienData } from '../data';
import { prepareIndex } from './lookup';
import { translateWithIndex } from './translate';
import type { RaceIndex, WordIndexWords } from './types';

const COMPONENT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'components',
  'TranslateView.svelte',
);

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'alien-word-index');
function load<T>(file: string): T {
  const s = readFileSync(join(DIR, file), 'utf8');
  const a = s.match(/\]\s*=\s*/);
  if (!a || a.index === undefined) throw new Error(`no assignment in ${file}`);
  return JSON.parse(s.slice(s.indexOf('{', a.index + a[0].length), s.lastIndexOf('}') + 1)) as T;
}

const words = load<WordIndexWords>('words.js');
const gek = prepareIndex(load<RaceIndex>('gek.js'), words);
const dictionary = new Set(alienData.entries.filter((e) => e.race === 'Gek').map((e) => e.surface.toLowerCase()));
const source = readFileSync(COMPONENT, 'utf8');

/** Position of a rule in the stylesheet, so ordering can be asserted. */
function ruleAt(selector: string): number {
  const at = source.indexOf(selector);
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1);
  return at;
}

describe('index-only words are told apart', () => {
  const indexOnly = gek.surfaces.filter((s) => !dictionary.has(s));
  const inDictionary = [...dictionary].filter((s) => gek.bySurface.has(s));

  it('has plenty of both kinds, so the colour is doing real work', () => {
    expect(indexOnly.length).toBeGreaterThan(4000);
    expect(inDictionary.length).toBeGreaterThan(1000);
  });

  it('badges the two kinds opposite ways', () => {
    const result = translateWithIndex(gek, words, `${indexOnly[0]} ${inDictionary[0]}`, 'Gek', 'alien-to-english', {
      dictionary,
    });
    const badges = result.segments.filter((s) => s.status !== 'separator').map((s) => s.badge);
    expect(badges).toEqual(['generated', 'dictionary']);
  });

  it('never badges an unknown word, so red keeps meaning missing', () => {
    const result = translateWithIndex(gek, words, 'zzqqx', 'Gek', 'alien-to-english', { dictionary });
    expect(result.segments[0]?.badge).toBeNull();
    expect(result.segments[0]?.status).toBe('unknown');
  });
});

describe('the stylesheet', () => {
  it('paints index words green', () => {
    expect(source).toMatch(/\.result-copy \.from-index\s*\{[^}]*color:\s*#7ce4a4/);
  });

  it('wins over the ambiguous amber, which has the same specificity', () => {
    // Both are two class selectors, so the later one wins. If the green rule
    // moves above the amber, an ambiguous index word turns amber again.
    expect(ruleAt('.result-copy .from-index {')).toBeGreaterThan(
      ruleAt('.result-copy .ambiguous-lookup {'),
    );
  });

  it('draws every marker underline the same way, so the dots line up', () => {
    // The ambiguous button used to use border-bottom, which sits lower than a
    // text underline and left the two kinds of dotted line at different depths.
    expect(source).not.toMatch(/border-bottom:[^;]*dotted/);
    const shared = source.match(
      /\.result-copy \.unknown,\s*\n\s*\.result-copy \.from-index,\s*\n\s*\.result-copy \.ambiguous-lookup\s*\{[^}]*text-decoration: underline dotted[^}]*text-underline-offset/,
    );
    expect(shared, 'the three marker rules must share one underline declaration').not.toBeNull();
  });

  it('underlines the green index words too', () => {
    // Green is a word the index invented, so it carries the same dotted line as
    // the amber and red words. Green with no underline reads as plain text.
    expect(source).toMatch(/\.result-copy \.from-index \{[^}]*color:\s*#7ce4a4/);
    expect(source).toMatch(/\.result-copy \.from-index,\s*\n\s*\.result-copy \.ambiguous-lookup/);
  });

  it('keeps the unknown word red', () => {
    expect(source).toMatch(/\.result-copy span\.unknown\s*\{[^}]*color:\s*#ff8f82/);
  });
});

describe('the panel stays quiet', () => {
  it('does not explain a miss under the notice', () => {
    // The notice is a short count plus the tokens. The longer sentence about the
    // size of the language was taking more room than the miss was worth.
    expect(source).not.toContain('notice-explain');
    expect(source).not.toContain('indexMissNote');
  });

  it('does not print the word list size or the badge tally', () => {
    expect(source).not.toContain('indexScopeText');
    expect(source).not.toContain('indexBadgeCounts');
    expect(source).not.toContain('index-scope');
    expect(source).not.toContain('badge-key');
  });

  it('still offers the suggestions, which is the part that helps', () => {
    expect(source).toContain('indexedSuggestions');
    expect(source).toContain('Suggestion only, not a translation');
  });
});
