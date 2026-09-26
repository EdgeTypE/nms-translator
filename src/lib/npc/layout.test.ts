import { describe, expect, it } from 'vitest';
import { computeStageLayout } from './layout';

describe('computeStageLayout', () => {
  it('matches the npc_mockup reference geometry at 1920x1080', () => {
    const layout = computeStageLayout(1920, 1080);

    expect(layout.panel.left).toBeCloseTo(134.7368, 3);
    expect(layout.panel.top).toBeCloseTo(796.8421, 3);
    expect(layout.panel.width).toBeCloseTo(1216.8421, 3);
    expect(layout.panel.height).toBeCloseTo(237.8947, 3);
    expect(layout.inputBottom).toBeCloseTo(329.1579, 3);
    expect(layout.optionsBottom).toBeCloseTo(45.2632, 3);
    expect(layout.frameScale.x).toBeCloseTo(0.95, 5);
    expect(layout.frameScale.y).toBeCloseTo(0.95, 5);
  });

  it('preserves the reference proportions at a smaller 16:9 viewport', () => {
    const layout = computeStageLayout(1280, 720);

    expect(layout.panel.left).toBeCloseTo(89.8246, 3);
    expect(layout.panel.top).toBeCloseTo(531.2281, 3);
    expect(layout.panel.width).toBeCloseTo(811.2281, 3);
    expect(layout.panel.height).toBeCloseTo(158.5965, 3);
    expect(layout.frameScale.x).toBeCloseTo(0.95, 5);
    expect(layout.frameScale.y).toBeCloseTo(0.95, 5);
  });

  it('clamps the dialogue panel inside narrow viewports', () => {
    const layout = computeStageLayout(390, 844);

    expect(layout.panel.left).toBe(10);
    expect(layout.panel.width).toBe(370);
    expect(layout.panel.width).toBeGreaterThan(0);
  });
});
