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
