/**
 * Attribution for everything that is not ours, and the one paragraph that has to
 * be on screen about the game's own data.
 *
 * The About dialog renders this list, and the paths in it point at the licence
 * texts shipped inside public/ rather than at upstream websites. A notice that
 * only resolves with a network round trip is not a notice a visitor can actually
 * act on: the whole site works offline, and so does this.
 *
 * `text` is deliberately a repo-relative path, not a URL. publicAsset() resolves
 * the deployment base at runtime, so the same string works on a GitHub Pages
 * subpath and in a local preview without being written twice.
 */
import { publicAsset } from './assets';

export interface LicenseNotice {
  /** Stable key, used by the contract test. */
  id: string;
  /** What it is, as it appears in the UI. */
  name: string;
  /** What this project uses it for. */
  role: string;
  /** Full licence name. */
  license: string;
  /** Copyright holder. */
  holder: string;
  /** Upstream page for the licence or the project. */
  url: string;
  /** Repo-relative path to the full text, shipped in public/. */
  text: string;
  /**
   * Declared modification, or null when nothing was changed.
   *
   * The SIL OFL is the reason this field is not optional: it lets anyone modify
   * and redistribute a font, but only if the modification is stated. The woff2
   * files here are subsets, so the declaration is owed and there is nowhere else
   * in the project that could carry it.
   */
  changes: string | null;
  /** Extra note shown under the entry. */
  note?: string;
}

/**
 * Licences of the fonts and libraries that ship in the page or its bundle.
 *
 * Ordered the way a reader cares about it: the two typefaces are what they are
 * looking at, then the code they might audit, then the build framework.
 *
 * tesseract.js and tesseract.js-core share one entry on purpose. Both are
 * Apache-2.0 and both ship the identical text, so a second copy of the same
 * 11 KB notice would add weight without adding information. Neither package
 * carries a NOTICE file, so the Apache-2.0 section 4(d) obligation does not
 * apply and there is nothing else to surface.
 *
 * Every `url` below has been resolved by hand. Rajdhani is the trap: Indian
 * Type Foundry designed it and hold the copyright, but their Rajdhani repo on
 * GitHub no longer exists and returns 404. The OFL text shipped in
 * public/fonts/ is byte-for-byte the one in google/fonts at
 * ofl/rajdhani/OFL.txt, which is where these woff2 files came from, so that
 * directory is the honest upstream rather than a re-serve.
 */
export const LICENSES: LicenseNotice[] = [
  {
    id: 'rajdhani',
    name: 'Rajdhani',
    role: 'Interface typeface',
    license: 'SIL Open Font License 1.1',
    holder: 'Indian Type Foundry, 2014',
    url: 'https://github.com/google/fonts/tree/main/ofl/rajdhani',
    text: 'fonts/OFL-Rajdhani.txt',
    changes: 'Subset to woff2, Latin, weights 300 to 700.',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    role: 'NPC dialogue typeface',
    license: 'SIL Open Font License 1.1',
    holder: 'The Roboto Project Authors, 2011',
    url: 'https://github.com/googlefonts/roboto-classic',
    text: 'fonts/OFL-Roboto.txt',
    changes: 'Subset to woff2, Latin, weights 300 to 500.',
  },
  {
    id: 'tesseract',
    name: 'tesseract.js + tesseract.js-core',
    role: 'Screenshot OCR for the image scan',
    license: 'Apache License 2.0',
    holder: 'The tesseract.js contributors',
    url: 'https://github.com/naptha/tesseract.js',
    text: 'licenses/Apache-2.0.txt',
    // Unmodified, and the licence allows redistribution unmodified.
    changes: null,
    // The wrapper is bundled, but the engine it drives is not: the wasm core and
    // the language data are fetched from the project's CDN on the first scan and
    // are never redistributed here. Apache-2.0 section 4(a) is satisfied for the
    // bundled part by the text in public/licenses/.
    note:
      'The engine wasm and the language data are fetched from the tesseract.js CDN on first use, not redistributed.',
  },
  {
    id: 'svelte',
    name: 'Svelte',
    role: 'UI framework',
    license: 'MIT',
    holder: 'Svelte Contributors, 2016-2025',
    url: 'https://github.com/sveltejs/svelte',
    text: 'licenses/MIT-Svelte.txt',
    changes: null,
  },
];

/**
 * The paragraph that has to accompany the word lists and the artwork.
 *
 * Deliberately says what the status is instead of implying permission: the
 * archives here are extracted from the game's own files, they are not this
 * project's to license, and saying so is the honest description.
 *
 * There is deliberately no "unofficial fan project" line here. The site footer
 * already states it in full, directly below the dialog that quotes this, and
 * repeating it on one screen only made the notice read as boilerplate.
 */
export const GAME_ASSETS_NOTICE = {
  title: 'The game data',
  body:
    'The word lists, the species artwork and the character portraits in this ' +
    'repository are extracted from No Man\u2019s Sky and belong to Hello Games. ' +
    'They are reproduced here for a fan project and are not licensed by this ' +
    'repository. No Man\u2019s Sky is a trademark of Hello Games.',
} as const;

/** Resolves a notice's shipped text against the deployment base. */
export function licenseHref(notice: LicenseNotice): string {
  return publicAsset(notice.text);
}
