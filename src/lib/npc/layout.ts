export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StageLayout {
  panel: StageRect;
  inputBottom: number;
  optionsBottom: number;
  frameScale: {
    x: number;
    y: number;
  };
}

export const REFERENCE_WIDTH = 1920;
export const REFERENCE_HEIGHT = 1080;
export const PARALLAX_ZOOM = 0.95;

/**
 * Recreates the exact 1920x1080 reference geometry used by npc_mockup.html.
 * Every element is positioned from the same cover-scale calculation so the
 * canvas framing and the dialogue UI never drift apart.
 */
export function computeStageLayout(width: number, height: number): StageLayout {
  const coverScale = Math.max(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
  const uiScale = coverScale / PARALLAX_ZOOM;

  const x = (value: number) => width / 2 + (value - REFERENCE_WIDTH / 2) * uiScale;
  const y = (value: number) => height / 2 + (value - REFERENCE_HEIGHT / 2) * uiScale;

  const left = Math.max(x(176), 10);
  const right = Math.min(x(1332), width - 10);
  const top = y(784);
  const bottom = y(1010);

  return {
    panel: {
      left,
      top,
      width: right - left,
      height: bottom - top,
    },
    inputBottom: height - top + 46,
    optionsBottom: height - bottom,
    frameScale: {
      x: (width / (REFERENCE_WIDTH * coverScale)) * PARALLAX_ZOOM,
      y: (height / (REFERENCE_HEIGHT * coverScale)) * PARALLAX_ZOOM,
    },
  };
}
