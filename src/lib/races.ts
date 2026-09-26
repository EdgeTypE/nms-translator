import type { RaceName } from './types';

export interface RaceMeta {
  name: RaceName;
  designation: string;
  accent: string;
  description: string;
  speechModel: string;
}

export const RACE_META: Record<RaceName, RaceMeta> = {
  Gek: {
    name: 'Gek',
    designation: 'TRADERS',
    accent: '#54dce8',
    description: 'Restless merchants and relentless negotiators.',
    speechModel: 'Region_NO',
  },
  Korvax: {
    name: 'Korvax',
    designation: 'EXPLORERS',
    accent: '#dbe9ff',
    description: 'Stoic voidborne scholars mapping the unknown.',
    speechModel: 'Region_RU',
  },
  "Vy'keen": {
    name: "Vy'keen",
    designation: 'WARRIORS',
    accent: '#ff795e',
    description: 'Direct combatants driven by pride and momentum.',
    speechModel: 'Region_CH',
  },
  Atlas: {
    name: 'Atlas',
    designation: 'ANCIENT INTELLIGENCE',
    accent: '#ffd84b',
    description: 'A silent intelligence woven through the galaxy.',
    speechModel: 'Generic',
  },
  Autophage: {
    name: 'Autophage',
    designation: 'BUILDERS',
    accent: '#a8ffdf',
    description: 'An algorithmic civilization that recycles all matter.',
    speechModel: 'Generic',
  },
};

/**
 * NPC dialogue accent per species: translated text, the speaker name, the HUD
 * and the interactive highlights. Deliberately separate from RACE_META.accent,
 * which drives the phrasebook species cards and has its own palette.
 *
 * Vy'keen and Atlas read below WCAG AA against the dialogue panel at narrow
 * widths and for the speaker name at any width. These values are intentional.
 */
export const NPC_ACCENT: Record<RaceName, string> = {
  Gek: '#86e070',
  Korvax: '#ddb7ff',
  "Vy'keen": '#ff4826',
  Atlas: '#ff2b2b',
  Autophage: '#b4d2ff',
};
