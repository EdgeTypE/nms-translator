/**
 * Contract tests for the About dialog's licence list.
 *
 * The dialog is the site's notice, so a bad entry here is a legal notice that
 * does not reach anyone: a path that 404s is worse than no link, because it
 * looks like the licence was served. These tests pin the properties that make
 * every entry actually usable, rather than the exact wording of the prose.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GAME_ASSETS_NOTICE,
  LICENSES,
  licenseHref,
} from './licenses';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const ids = () => LICENSES.map((notice) => notice.id);

describe('licence list', () => {
  it('gives every entry a unique id', () => {
    expect(new Set(ids()).size).toBe(LICENSES.length);
  });

  it('resolves every shipped text to a real file in public/', () => {
    for (const notice of LICENSES) {
      const file = join(PUBLIC_DIR, notice.text);
      expect(existsSync(file), `${notice.id} -> ${notice.text} is missing`).toBe(true);
    }
  });

  it('ships text that is actually a licence, not a stub', () => {
    for (const notice of LICENSES) {
      const body = readFileSync(join(PUBLIC_DIR, notice.text), 'utf8');
      expect(body.length, `${notice.id} text is suspiciously short`).toBeGreaterThan(400);
      expect(body, `${notice.id} text has no licence heading`).toMatch(
        /Permission is hereby granted|Licensed under the Apache License|This Font Software is licensed/i,
      );
    }
  });

  it('names a holder and a licence for every entry', () => {
    for (const notice of LICENSES) {
      expect(notice.holder.trim(), `${notice.id} has no holder`).not.toBe('');
      expect(notice.license.trim(), `${notice.id} has no licence name`).not.toBe('');
      expect(notice.role.trim(), `${notice.id} has no role`).not.toBe('');
    }
  });

  it('gives every entry two distinct targets: upstream and a shipped copy', () => {
    // The reason this pair exists. The name links to the project; the LICENCE
    // button links to the copy inside public/. MIT and Apache-2.0 require the
    // notice to travel inside the distribution, and Svelte's compiled output and
    // tesseract.js are both in this bundle, so a link to a licence hosted
    // elsewhere cannot replace the shipped text. Dropping either half breaks
    // something real, so it is pinned here rather than left to judgement.
    for (const notice of LICENSES) {
      expect(notice.url, `${notice.id} has no upstream page`).toMatch(/^https:\/\//);
      expect(notice.text, `${notice.id} has no shipped copy`).not.toBe('');
      expect(notice.url).not.toBe(notice.text);
    }
  });

  it('links upstream over https', () => {
    for (const notice of LICENSES) {
      expect(notice.url, `${notice.id} is not https`).toMatch(/^https:\/\//);
    }
  });

  /**
   * Pinned on purpose.
   *
   * A scheme-only check is not enough: this list is rendered as links, and a
   * 404 in a licence notice is worse than no link, because it reads as though
   * the licence was served. The Rajdhani entry was exactly that once - Indian
   * Type Foundry's Rajdhani repo returns 404, so the address had to be
   * reassigned to the google/fonts directory the woff2 files and the shipped
   * OFL.txt actually came from.
   *
   * Asserting the exact strings means any future edit to a url fails here and
   * has to be resolved by hand first, rather than shipping quietly. All four
   * were checked on 2026-09-30 and returned 200.
   */
  it('pins the upstream addresses that were verified to resolve', () => {
    const urls = Object.fromEntries(LICENSES.map((notice) => [notice.id, notice.url]));
    expect(urls).toEqual({
      rajdhani: 'https://github.com/google/fonts/tree/main/ofl/rajdhani',
      roboto: 'https://github.com/googlefonts/roboto-classic',
      tesseract: 'https://github.com/naptha/tesseract.js',
      svelte: 'https://github.com/sveltejs/svelte',
    });
  });

  it('points text at the repo rather than at a website', () => {
    for (const notice of LICENSES) {
      // An absolute URL here would mean the notice stops working offline.
      expect(notice.text, `${notice.id} text is not repo-relative`).not.toMatch(/^[a-z]+:/i);
      expect(notice.text, `${notice.id} text should not climb out of public/`).not.toMatch(/^\.\./);
    }
  });

  it('states a modification for every font, as the OFL requires', () => {
    const fonts = LICENSES.filter((notice) => notice.license.startsWith('SIL Open Font License'));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.changes, `${font.id} was subset but no change is declared`).not.toBeNull();
      expect(font.changes?.trim()).not.toBe('');
    }
  });

  it('declares no modification where there was none', () => {
    for (const notice of LICENSES) {
      if (notice.license.startsWith('SIL Open Font License')) continue;
      expect(notice.changes, `${notice.id} claims an unexplained change`).toBeNull();
    }
  });

  it('covers both shipped runtime dependencies and both typefaces', () => {
    expect(ids()).toEqual(['rajdhani', 'roboto', 'tesseract', 'svelte']);
  });

  it('resolves hrefs through the deployment base', () => {
    for (const notice of LICENSES) {
      const href = licenseHref(notice);
      expect(href.endsWith(notice.text)).toBe(true);
      expect(href).not.toMatch(/^[a-z]+:/i);
    }
  });
});

describe('game data notice', () => {
  it('credits the word lists and artwork to Hello Games', () => {
    expect(GAME_ASSETS_NOTICE.body).toMatch(/Hello Games/);
    expect(GAME_ASSETS_NOTICE.body).toMatch(/No Man\u2019s Sky is a trademark/);
  });

  // The site footer already carries this wording, so the dialog must not repeat
  // it. Pinned so the duplication cannot creep back into the data source.
  it('does not repeat the footer disclaimer', () => {
    expect(Object.keys(GAME_ASSETS_NOTICE)).toEqual(['title', 'body']);
  });
});
