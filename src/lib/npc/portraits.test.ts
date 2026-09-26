import { describe, expect, it } from 'vitest';
import { NPC_PORTRAITS, getNpcPortrait } from './portraits';

describe('NPC portrait map', () => {
  it('maps every race to a color and depth texture pair', () => {
    for (const portrait of Object.values(NPC_PORTRAITS)) {
      expect(portrait.color).toMatch(/\.(jpg|png|webp)$/);
      expect(portrait.depth).toMatch(/\.(png|webp)$/);
      expect(portrait.depthRange).toHaveLength(2);
      expect(portrait.npcName.length).toBeGreaterThan(0);
    }
  });

  it('uses the decoded height map produced by the asset pipeline', () => {
    expect(NPC_PORTRAITS.Gek.depth).toMatch(/gek_height\.png$/);
    expect(NPC_PORTRAITS.Gek.depthRange).toEqual([0, 1]);
    expect(NPC_PORTRAITS.Gek.color).toMatch(/gek_plate\.jpg$/);
  });

  it('keeps Atlas on its own replaceable file path', () => {
    expect(NPC_PORTRAITS.Atlas.color).toMatch(/atlas_plate\.jpg$/);
    expect(NPC_PORTRAITS.Atlas.depth).toMatch(/atlas_height\.png$/);
  });

  it('uses the Gek pair as the temporary Autophage fallback', () => {
    expect(getNpcPortrait('Autophage').color).toBe(NPC_PORTRAITS.Gek.color);
    expect(getNpcPortrait('Autophage').depth).toBe(NPC_PORTRAITS.Gek.depth);
    expect(getNpcPortrait('Autophage').usesFallback).toBe(true);
  });
});
