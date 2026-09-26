import { writable } from 'svelte/store';
import type { TranslationDirection } from '../types';

/**
 * Shared conversation buffer that bridges the Translate view and the NPC
 * dialogue view. Both views are mounted exclusively (App renders one or the
 * other), so this module-level store is the hand-off point: whichever view is
 * active keeps it in sync, and the next view seeds its input from it on mount.
 * The selected race is intentionally not stored here — it already lives in
 * App and is persisted.
 */
export interface ConversationDraft {
  text: string;
  direction: TranslationDirection;
}

export const conversationDraft = writable<ConversationDraft>({
  text: '',
  direction: 'alien-to-english',
});
