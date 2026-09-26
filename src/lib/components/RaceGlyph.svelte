<script lang="ts">
  import type { RaceName } from '../types';

  export let race: RaceName;
  export let size = 44;
  export let strokeWidth = 1.8;
</script>

<svg
  class="race-glyph"
  class:small={size < 40}
  width={size}
  height={size}
  viewBox="0 0 64 64"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if race === 'Gek'}
    <path d="M17 45 20 18l12 20 12-20 3 27" />
    <path d="M14 45h36M20 52h24M25 57h14" />
    <circle cx="32" cy="12" r="2" fill="currentColor" stroke="none" />
  {:else if race === 'Korvax'}
    <path d="M12 34c0-11 8-19 20-19s20 8 20 19-8 18-20 18-20-7-20-18Z" />
    <path d="M22 34c0-5 4-9 10-9s10 4 10 9-4 9-10 9-10-4-10-9Z" />
    <circle cx="32" cy="34" r="3" fill="currentColor" stroke="none" />
    <path d="M9 25 3 19M55 25l6-6M9 43l-6 6M55 43l6 6" />
  {:else if race === "Vy'keen"}
    <path d="m32 7 20 20-7 7H19l-7-7Z" />
    <path d="m19 34-7 23 20-13 20 13-7-23M25 25l7 7 7-7" />
    <path d="M25 48h14" />
  {:else if race === 'Atlas'}
    <path d="M32 6 46 32 32 58 18 32Z" />
    <path d="M32 18 39 32l-7 14-7-14Z" />
    <circle cx="32" cy="32" r="2" fill="currentColor" stroke="none" />
  {:else if race === 'Autophage'}
    <path d="m32 6 8 9 11-1 1 11 8 7-8 7-1 11-11-1-8 8-8-8-11 1-1-11-8-7 8-7 1-11 11 1Z" />
    <path d="m32 18 5 7 8 1-3 7 4 7-8-1-6 6-6-6-8 1 4-7-3-7 8-1Z" />
    <circle cx="32" cy="33" r="4" fill="currentColor" stroke="none" />
  {/if}
</svg>

<style>
  .race-glyph {
    display: block;
    overflow: visible;
    filter: drop-shadow(0 0 6px color-mix(in srgb, currentColor 35%, transparent));
  }

  .race-glyph.small {
    filter: none;
  }
</style>
