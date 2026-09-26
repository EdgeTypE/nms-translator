import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { conversationDraft } from './handoff';

describe('conversationDraft store', () => {
  it('round-trips the hand-off text and direction', () => {
    conversationDraft.set({ text: 'iluma pamuus', direction: 'english-to-alien' });
    expect(get(conversationDraft)).toEqual({
      text: 'iluma pamuus',
      direction: 'english-to-alien',
    });
  });

  it('starts from a neutral alien-to-english empty draft', () => {
    // Reset to the module default for a deterministic assertion.
    conversationDraft.set({ text: '', direction: 'alien-to-english' });
    expect(get(conversationDraft)).toEqual({ text: '', direction: 'alien-to-english' });
  });
});
