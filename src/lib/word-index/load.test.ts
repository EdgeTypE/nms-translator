/**
 * The lazy half of the loader, tested against a stub document.
 *
 * The point of the whole design is that a species file is not requested until
 * that species is used, and never twice. Both are properties of when <script>
 * tags get appended, so the stub records the appends and nothing else runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetWordIndexCache, getWordList, isBootstrapped, loadRaceIndex, peekRaceIndex } from './load';

interface Appended {
  src: string;
  /** The script ran and assigned its payload. */
  resolve: () => void;
  /** The request itself failed, as a 404 would. */
  fail: () => void;
}

let appended: Appended[] = [];
let globalScope: Record<string, unknown>;
/** Files that will load but assign nothing, standing in for a truncated one. */
let broken = new Set<string>();

interface StubNode {
  src: string;
  async: boolean;
  listeners: Array<{ type: string; fn: () => void }>;
  addEventListener: (type: string, fn: () => void) => void;
}

/** Stands in for the browser: a head that collects scripts, and a window. */
function installDom(): void {
  appended = [];
  globalScope = {
    NMS_ALIEN_INDEX: {
      manifest: {
        schema: 1,
        races: [
          { name: 'Gek', file: 'data/alien-word-index/gek.js' },
          { name: "Vy'keen", file: 'data/alien-word-index/vykeen.js' },
        ],
      },
      words: {
        schema: 1,
        count: 3,
        words: ['hello', 'goodbye', 'welcome'],
        source: { scope: 'speech-table', vocabularySize: 3 },
      },
    },
  };

  vi.stubGlobal('window', globalScope);
  vi.stubGlobal('document', {
    head: {
      appendChild(node: StubNode) {
        const fire = (type: string) => {
          for (const listener of node.listeners) {
            if (listener.type === type) listener.fn();
          }
        };
        appended.push({
          src: node.src,
          // A real <script src> runs the file, which then assigns onto window,
          // and only then fires the load event.
          resolve: () => {
            const name = node.src.split('/').pop()!;
            if (broken.has(name)) {
              fire('load');
              return;
            }
            if (name === 'gek.js') {
              (globalScope.NMS_ALIEN_INDEX as Record<string, unknown>)['races/Gek'] = {
                race: 'Gek',
                rows: ['aberg 2 0', 'pupkessap 0 0'],
              };
            } else {
              (globalScope.NMS_ALIEN_INDEX as Record<string, unknown>)["races/Vy'keen"] = {
                race: "Vy'keen",
                rows: ['ogatuu 1 0'],
              };
            }
            fire('load');
          },
          fail: () => fire('error'),
        });
      },
    },
    createElement: (): StubNode => {
      const node: StubNode = {
        src: '',
        async: false,
        listeners: [],
        addEventListener: () => undefined,
      };
      node.addEventListener = (type: string, fn: () => void) => {
        node.listeners.push({ type, fn });
      };
      return node;
    },
  });
}

beforeEach(() => {
  installDom();
  broken = new Set();
  __resetWordIndexCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bootstrap files', () => {
  it('reads the manifest and word list the page already loaded', () => {
    expect(isBootstrapped()).toBe(true);
    expect(getWordList()?.count).toBe(3);
  });

  it('does not request anything before a species is asked for', () => {
    expect(appended).toHaveLength(0);
    expect(peekRaceIndex('Gek')).toBeNull();
  });
});

describe('loadRaceIndex', () => {
  it('appends exactly one script, for that species only', async () => {
    const promise = loadRaceIndex('Gek');
    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe('/data/alien-word-index/gek.js');

    appended[0]?.resolve();
    const index = await promise;
    expect(index?.race).toBe('Gek');
    expect(index?.surfaces).toEqual(['aberg', 'pupkessap']);
  });

  it('never fetches a species that was not selected', async () => {
    const promise = loadRaceIndex('Gek');
    appended[0]?.resolve();
    await promise;
    expect(appended.map((a) => a.src)).toEqual(['/data/alien-word-index/gek.js']);
  });

  it('reuses the cache instead of appending a second script', async () => {
    const first = loadRaceIndex('Gek');
    appended[0]?.resolve();
    await first;

    const second = await loadRaceIndex('Gek');
    expect(appended).toHaveLength(1);
    // The same prepared index comes back, not a rebuilt copy.
    expect(second).toBe(await first);
    expect(peekRaceIndex('Gek')).toBe(second);
  });

  it('shares one request between callers that race each other', async () => {
    const a = loadRaceIndex('Gek');
    const b = loadRaceIndex('Gek');
    expect(appended).toHaveLength(1);
    appended[0]?.resolve();
    expect(await a).toBe(await b);
  });

  it('loads a second species on demand, keeping the first', async () => {
    const gekPromise = loadRaceIndex('Gek');
    appended[0]?.resolve();
    await gekPromise;

    const vyPromise = loadRaceIndex("Vy'keen");
    expect(appended).toHaveLength(2);
    expect(appended[1]?.src).toBe('/data/alien-word-index/vykeen.js');
    appended[1]?.resolve();
    await vyPromise;

    expect(peekRaceIndex('Gek')?.surfaces).toEqual(['aberg', 'pupkessap']);
    expect(peekRaceIndex("Vy'keen")?.surfaces).toEqual(['ogatuu']);
  });

  it('returns nothing for a species the manifest does not list', async () => {
    expect(await loadRaceIndex('Korvax')).toBeNull();
    expect(appended).toHaveLength(0);
  });

  it('retries after a script loads but registers nothing', async () => {
    broken.add('gek.js');
    const first = loadRaceIndex('Gek');
    appended[0]?.resolve();
    expect(await first).toBeNull();

    // The miss must not be cached: a second attempt asks again.
    broken.delete('gek.js');
    const second = loadRaceIndex('Gek');
    expect(appended).toHaveLength(2);
    appended[1]?.resolve();
    expect(await second).not.toBeNull();
  });

  it('retries after a network failure', async () => {
    const failing = loadRaceIndex('Gek');
    const node = appended[0]!;
    // Fire only the error listener, as a 404 would.
    node.fail();
    expect(await failing).toBeNull();

    const second = loadRaceIndex('Gek');
    expect(appended).toHaveLength(2);
    appended[1]?.resolve();
    expect(await second).not.toBeNull();
  });
});
