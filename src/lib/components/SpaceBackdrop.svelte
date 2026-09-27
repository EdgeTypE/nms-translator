<script lang="ts">
  // Decorative, non-interactive scene layer.
</script>

<div class="space-backdrop" aria-hidden="true">
  <div class="scanlines"></div>
  <div class="vignette"></div>
</div>

<style>
  /* The scene is the game's own plate rather than a CSS reconstruction of it.
     Everything the plate already provides - the star field, the blue and
     crimson wash, the diamond facets, the dot matrix and the planet with its
     rings - used to be drawn here in about 200 lines of gradients and an
     inline SVG. Those layers are gone; the scrim below is all that stands
     between the plate and the panels, so it is the only dial for how bright
     the backdrop reads. Raise the three stops if the panels start to look
     washed out.

     The scanlines and the vignette are kept because they are the site's own
     CRT/HUD signature, not part of the plate. */
  .space-backdrop {
    --scrim-top: .32;
    --scrim-mid: .24;
    --scrim-bottom: .42;

    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    /* Flat navy underneath, so a browser that cannot decode AVIF still gets
       a sane backdrop instead of nothing. */
    background-color: #02050d;
    background-image:
      linear-gradient(
        180deg,
        rgb(2 5 13 / var(--scrim-top)) 0%,
        rgb(2 5 13 / var(--scrim-mid)) 45%,
        rgb(2 5 13 / var(--scrim-bottom)) 100%
      ),
      url('/background.avif');
    background-size: cover, cover;
    /* Anchored to the bottom so the crimson core stays put; a centred
       position would drift it upward on tall viewports. */
    background-position: center bottom, center bottom;
    background-repeat: no-repeat, no-repeat;
  }

  .scanlines {
    position: absolute;
    inset: 0;
    opacity: .075;
    background: repeating-linear-gradient(to bottom, transparent 0 3px, rgba(121, 208, 224, .22) 4px);
    mix-blend-mode: soft-light;
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 2, 9, .72) 100%);
  }

  @media (max-width: 800px) {
    /* A 2:1 plate cropped into a portrait viewport loses ~77% of its width
       and centres on the bright core, so the scrim has to be heavier here
       than on desktop. */
    .space-backdrop {
      --scrim-top: .46;
      --scrim-mid: .38;
      --scrim-bottom: .6;
    }
  }
</style>
