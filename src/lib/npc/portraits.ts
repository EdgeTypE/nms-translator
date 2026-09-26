import type { RaceName } from '../types';

export interface NpcPortrait {
  color: string;
  depth: string;
  depthRange: [number, number];
  npcName: string;
  usesFallback: boolean;
}

const publicAsset = (file: string) => `${import.meta.env.BASE_URL}${file}`;

/**
 * Colour = UI-inpainted plate, depth = decoded grayscale height map.
 * Both are produced by tools/process_npc_assets.py. The height maps are
 * already normalised to [0,1], so the shader depth range is identity.
 *
 * Autophage temporarily reuses the Gek pair until its own portrait is added.
 * Atlas keeps its own file path so replacing the current placeholder requires
 * only re-running the asset script.
 */
export const NPC_PORTRAITS: Record<RaceName, NpcPortrait> = {
  Gek: {
    color: publicAsset('gek_plate.jpg'),
    depth: publicAsset('gek_height.png'),
    depthRange: [0, 1],
    npcName: 'Captain Leju',
    usesFallback: false,
  },
  Korvax: {
    color: publicAsset('korvax_plate.jpg'),
    depth: publicAsset('korvax_height.png'),
    depthRange: [0, 1],
    npcName: 'Entity Upinsar',
    usesFallback: false,
  },
  "Vy'keen": {
    color: publicAsset('vykenn_plate.jpg'),
    depth: publicAsset('vykenn_height.png'),
    depthRange: [0, 1],
    npcName: 'Conscript Geogju',
    usesFallback: false,
  },
  Atlas: {
    color: publicAsset('atlas_plate.jpg'),
    depth: publicAsset('atlas_height.png'),
    depthRange: [0, 1],
    npcName: 'Atlas',
    usesFallback: false,
  },
  Autophage: {
    color: publicAsset('gek_plate.jpg'),
    depth: publicAsset('gek_height.png'),
    depthRange: [0, 1],
    npcName: 'Autophage',
    usesFallback: true,
  },
};

export function getNpcPortrait(race: RaceName): NpcPortrait {
  return NPC_PORTRAITS[race];
}
