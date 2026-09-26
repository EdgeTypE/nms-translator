import { writable } from 'svelte/store';

/**
 * One-shot hand-off for "look this word up in the phrasebook", triggered by the
 * dotted-underlined ambiguous words in the translator's output. The phrasebook
 * has a local search box rather than a URL parameter, so the word travels
 * through this store the same way the conversation buffer does, and is cleared
 * once the phrasebook has consumed it.
 */
export const phrasebookLookup = writable('');
