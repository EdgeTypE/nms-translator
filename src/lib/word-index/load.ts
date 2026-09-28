/**
 * Browser side of the word index: reads the bootstrap files the page already
 * loaded, and pulls a species file in the first time that species is selected.
 *
 * The files are classic scripts, not modules, so loading one means appending a
 * <script> tag and waiting for it. Each is requested at most once no matter how
 * often the visitor switches back and forth.
 */
import { publicAsset } from '../assets';
import type { RaceName } from '../types';
import { prepareIndex, type PreparedIndex } from './lookup';
import type { RaceIndex, WordIndexGlobal, WordIndexManifest, WordIndexWords } from './types';

const BOOTSTRAP_KEYS = ['manifest', 'words'] as const;

/** Locale-independent path segment: the file name drops the apostrophe. */
const RACE_FILE: Record<RaceName, string> = {
  Gek: 'gek',
  Korvax: 'korvax',
  "Vy'keen": 'vykeen',
  Atlas: 'atlas',
  Autophage: 'autophage',
};

function globalIndex(): WordIndexGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { NMS_ALIEN_INDEX?: WordIndexGlobal }).NMS_ALIEN_INDEX;
}

export function getManifest(): WordIndexManifest | null {
  const manifest = globalIndex()?.manifest as WordIndexManifest | undefined;
  return manifest && Array.isArray(manifest.races) ? manifest : null;
}

export function getWordList(): WordIndexWords | null {
  const words = globalIndex()?.words as WordIndexWords | undefined;
  return words && Array.isArray(words.words) ? words : null;
}

/** True once the two bootstrap scripts have run. */
export function isBootstrapped(): boolean {
  return getManifest() !== null && getWordList() !== null;
}

const scriptPromises = new Map<string, Promise<boolean>>();

/**
 * Forgets a script so the next attempt re-requests it. A network failure and a
 * file that loads but registers nothing are both recoverable; caching either one
 * would make a transient problem permanent for the rest of the session.
 */
function invalidateScript(relativePath: string): void {
  scriptPromises.delete(relativePath);
}

/** Injects a script once; repeat calls share the first promise. */
function loadScript(relativePath: string): Promise<boolean> {
  const existing = scriptPromises.get(relativePath);
  if (existing) return existing;

  const promise = new Promise<boolean>((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.src = publicAsset(relativePath);
    script.async = true;
    script.addEventListener('load', () => resolve(true), { once: true });
    script.addEventListener('error', () => {
      invalidateScript(relativePath);
      resolve(false);
    }, { once: true });
    document.head.appendChild(script);
  });

  scriptPromises.set(relativePath, promise);
  return promise;
}

const prepared = new Map<RaceName, PreparedIndex>();
const preparing = new Map<RaceName, Promise<PreparedIndex | null>>();

/**
 * Loads and prepares one species. The manifest supplies the path, so a species
 * only ever needs the file its own generator produced.
 */
export function loadRaceIndex(race: RaceName): Promise<PreparedIndex | null> {
  const cached = prepared.get(race);
  if (cached) return Promise.resolve(cached);

  const inFlight = preparing.get(race);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<PreparedIndex | null> => {
    const manifest = getManifest();
    if (!manifest) return null;
    const words = getWordList();
    if (!words) return null;
    const entry = manifest.races.find((item) => item.name === race);
    if (!entry) return null;

    const path = entry.file || `data/alien-word-index/${RACE_FILE[race]}.js`;
    const loaded = await loadScript(path);
    if (!loaded) return null;

    const payload = globalIndex()?.[`races/${race}`] as RaceIndex | undefined;
    if (!payload || !Array.isArray(payload.rows)) {
      // The script ran but left nothing behind, which is what a truncated or
      // mismatched file looks like. Allow a retry instead of pinning the miss.
      invalidateScript(path);
      return null;
    }

    const index = prepareIndex(payload, words);
    prepared.set(race, index);
    return index;
  })().finally(() => {
    preparing.delete(race);
  });

  preparing.set(race, promise);
  return promise;
}

/** Already loaded, without triggering a fetch. */
export function peekRaceIndex(race: RaceName): PreparedIndex | null {
  return prepared.get(race) ?? null;
}

/** Test seam: drops the cache so a fixture can be injected. */
export function __resetWordIndexCache(): void {
  prepared.clear();
  preparing.clear();
  scriptPromises.clear();
}
