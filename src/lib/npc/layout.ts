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
/** Breathing room kept between the bottom of the panel and the viewport edge. */
const SCREEN_MARGIN = 8;

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

  // The dialogue band is laid out around the viewport centre, so on short or
  // wide windows the reference bottom edge (1010) lands past the bottom of the
  // screen and the whole stack - input, speaker tag, panel - is clipped. Lift
  // the band by exactly the overflow so its size and width are untouched and
  // only its vertical position moves. Every other offset is derived from
  // top/bottom, so the input and the direction options travel with it.
  const referenceTop = y(784);
  const referenceBottom = y(1010);
  const lift = Math.max(0, referenceBottom - (height - SCREEN_MARGIN));
  const top = referenceTop - lift;
  const bottom = referenceBottom - lift;

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
