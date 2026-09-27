import { publicAsset } from '../assets';
import type { RaceName } from '../types';

export interface NpcPortrait {
  color: string;
  depth: string;
  depthRange: [number, number];
  npcName: string;
  usesFallback: boolean;
}

/**
 * Colour = UI-inpainted plate, depth = decoded grayscale height map.
 * Both are produced by tools/process_npc_assets.py. The height maps are
 * already normalised to [0,1], so the shader depth range is identity.
 *
 * Every species now ships its own pair. The tool inpaints the baked game UI for
 * the three dialogue frames and for Autophage, and re-encodes Atlas untouched
 * because that one is a clean render with no UI in it.
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
    color: publicAsset('autophage_plate.jpg'),
    depth: publicAsset('autophage_height.png'),
    depthRange: [0, 1],
    npcName: 'Autophage',
    usesFallback: false,
  },
};

export function getNpcPortrait(race: RaceName): NpcPortrait {
  return NPC_PORTRAITS[race];
}
