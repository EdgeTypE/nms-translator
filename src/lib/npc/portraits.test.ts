import { describe, expect, it } from 'vitest';
import { NPC_PORTRAITS, getNpcPortrait } from './portraits';
import type { RaceName } from '../types';

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

  it('gives Autophage its own pair now that the portrait exists', () => {
    expect(getNpcPortrait('Autophage').color).toMatch(/autophage_plate\.jpg$/);
    expect(getNpcPortrait('Autophage').depth).toMatch(/autophage_height\.png$/);
    expect(getNpcPortrait('Autophage').usesFallback).toBe(false);
  });

  it('never points two species at the same texture pair', () => {
    const races = Object.keys(NPC_PORTRAITS);
    const colors = new Set(races.map((race) => NPC_PORTRAITS[race as RaceName].color));
    const depths = new Set(races.map((race) => NPC_PORTRAITS[race as RaceName].depth));
    expect(colors.size).toBe(races.length);
    expect(depths.size).toBe(races.length);
  });
});
