import { writable } from 'svelte/store';

/**
 * Whether the translator has permanently hidden its "talk to an NPC" card.
 *
 * The card is a one-time invitation, not a persistent widget: once the visitor
 * dismisses it, it should stay gone. The flag lives in localStorage rather than
 * the session buffer in routing.ts, because dismissing it is a preference about
 * the site, not a property of the current draft.
 *
 * restoreNpcPromo() is exported but not called anywhere yet. It exists so the
 * settings page can undo this without duplicating the storage key.
 */
const KEY = 'nmt-npc-promo';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'dismissed';
  } catch {
    /* storage unavailable (private mode) — treat as not dismissed */
    return false;
  }
}

export const npcPromoDismissed = writable<boolean>(read());

function write(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(KEY, 'dismissed');
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* storage unavailable — the card still hides for this session */
  }
  npcPromoDismissed.set(value);
}

export function dismissNpcPromo(): void {
  write(true);
}

export function restoreNpcPromo(): void {
  write(false);
}
