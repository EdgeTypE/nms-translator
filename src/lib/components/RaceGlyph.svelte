<script lang="ts">
  import { RACE_ICON } from '../races';
  import type { RaceName } from '../types';

  export let race: RaceName;
  export let size = 44;
</script>

<!--
  The crests are full colour PNGs, so unlike the inline SVGs they used to be
  they cannot inherit `currentColor`. The surrounding rules still set `color`
  from the species accent, which now feeds the drop-shadow glow instead of the
  stroke. Kept at the small sizes the glow is dropped: it turns to mush there.
-->
<img
  class="race-glyph"
  class:small={size < 40}
  src={RACE_ICON[race]}
  alt=""
  aria-hidden="true"
  width={size}
  height={size}
/>

<style>
  .race-glyph {
    display: block;
    filter: drop-shadow(0 0 6px color-mix(in srgb, currentColor 35%, transparent));
  }

  .race-glyph.small {
    filter: none;
  }
</style>
