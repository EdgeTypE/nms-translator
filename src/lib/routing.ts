import type { RaceName, ViewId } from './types';

/** Directory path for each view (empty string = site root). */
export const VIEW_PATHS: Record<ViewId, string> = {
  translate: '',
  phrasebook: 'phrasebook',
  data: 'archive',
  npc: 'npc',
};

export const VIEWS: ViewId[] = ['translate', 'phrasebook', 'data', 'npc'];

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Strips the deployment base (e.g. /nms-translator) from a pathname. */
function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return '/';
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length);
  return pathname;
}

/** Normalises "/phrasebook/index.html" -> "/phrasebook/", "" -> "/". */
function normalise(pathname: string): string {
  const clean = stripBase(pathname).replace(/\/index\.html?$/i, '/');
  if (clean === '' || clean === '/') return '/';
  return clean.endsWith('/') ? clean : `${clean}/`;
}

/** Resolves the view for a given location (pathname + search). */
export function resolveView(location: { pathname: string; search: string }): ViewId {
  const path = normalise(location.pathname);

  for (const view of VIEWS) {
    const dir = VIEW_PATHS[view];
    if (!dir && path === '/') return view;
    if (dir && path === `/${dir}/`) return view;
  }

  // Back-compat: honour legacy ?view= links, then clean the URL.
  const legacy = new URLSearchParams(location.search).get('view');
  if (legacy && (VIEWS as string[]).includes(legacy)) return legacy as ViewId;

  return 'translate';
}

/** Public path for a view, always with a trailing slash. */
export function pathFor(view: ViewId): string {
  const dir = VIEW_PATHS[view];
  return `${BASE}${dir ? `/${dir}` : ''}/`;
}

/** Validates a race name coming from storage or a legacy query param. */
export function resolveRace(value: string | null, valid: readonly RaceName[]): RaceName | null {
  if (!value) return null;
  return (valid as readonly string[]).includes(value) ? (value as RaceName) : null;
}

const DRAFT_KEY = 'nmt-session';

export interface SessionState {
  race: RaceName;
  text: string;
  direction: 'alien-to-english' | 'english-to-alien';
}

/** Persists the active view's state so real page navigations keep the input. */
export function saveSession(state: SessionState): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — non-fatal */
  }
}

export function loadSession(): Partial<SessionState> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
