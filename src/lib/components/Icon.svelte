<script lang="ts">
  type IconName =
    | 'activity'
    | 'alert'
    | 'arrow-right'
    | 'book'
    | 'check'
    | 'chevron'
    | 'clipboard'
    | 'compass'
    | 'copy'
    | 'external'
    | 'filter'
    | 'github'
    | 'image'
    | 'info'
    | 'keyboard'
    | 'lock'
    | 'message'
    | 'refresh'
    | 'search'
    | 'shuffle'
    | 'sparkles'
    | 'star'
    | 'terminal'
    | 'translate'
    | 'trash'
    | 'x';

  export let name: IconName;
  export let size = 20;
  export let strokeWidth = 1.7;
</script>

<!-- The GitHub mark is a filled silhouette, so it opts out of the stroke
     treatment every other icon here uses. -->
<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={name === 'github' ? 'currentColor' : 'none'}
  stroke={name === 'github' ? 'none' : 'currentColor'}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'translate'}
    <path d="M4 5h10M9 3v2c0 4.7-2.1 8.2-5 11" />
    <path d="M6 9c1.7 2.7 3.8 4.6 6.3 5.8M13 21l4.2-10 4.3 10M15.2 17h4.1" />
  {:else if name === 'book'}
    <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z" />
    <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z" />
  {:else if name === 'copy'}
    <rect x="8" y="8" width="12" height="12" rx="1" />
    <path d="M16 8V4H4v12h4" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
  {:else if name === 'shuffle'}
    <path d="M4 7h3.5c4.5 0 5 10 9.5 10H20M17 4l3 3-3 3M4 17h3.5c1.8 0 2.8-1.4 3.8-3.1M13 8.2c.4-.8.9-1.2 1.5-1.2H20M17 14l3 3-3 3" />
  {:else if name === 'sparkles'}
    <path d="m12 2 1.2 4.2L17 8l-3.8 1.8L12 14l-1.2-4.2L7 8l3.8-1.8ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8ZM19 13l.6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6Z" />
  {:else if name === 'search'}
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  {:else if name === 'arrow-right'}
    <path d="M4 12h16M14 6l6 6-6 6" />
  {:else if name === 'check'}
    <path d="m4 12 5 5L20 6" />
  {:else if name === 'alert'}
    <path d="M12 3 2.5 20h19Z" />
    <path d="M12 9v5M12 17.5v.1" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.1" />
  {:else if name === 'x'}
    <path d="M5 5l14 14M19 5 5 19" />
  {:else if name === 'external'}
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v6H5V6h6" />
  {:else if name === 'terminal'}
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="m7 9 3 3-3 3M13 15h4" />
  {:else if name === 'chevron'}
    <path d="m8 10 4 4 4-4" />
  {:else if name === 'clipboard'}
    <path d="M8 5H5v16h14V5h-3M9 3h6v4H9Z" />
    <path d="M9 12h6M9 16h4" />
  {:else if name === 'compass'}
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5Z" />
  {:else if name === 'filter'}
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  {:else if name === 'refresh'}
    <path d="M20 6v5h-5M4 18v-5h5" />
    <path d="M6.1 8a7 7 0 0 1 11.7-1L20 11M4 13l2.2 4a7 7 0 0 0 11.7-1" />
  {:else if name === 'activity'}
    <path d="M3 12h4l2.2-6 4.1 12 2.4-6H21" />
  {:else if name === 'lock'}
    <rect x="5" y="10" width="14" height="11" rx="1" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  {:else if name === 'keyboard'}
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M7 13h.1M11 13h.1M15 13h2M7 16h10" />
  {:else if name === 'image'}
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m3 16 5-5 4 4 3-3 6 6" />
    <circle cx="8.5" cy="9" r="1.4" />
  {:else if name === 'message'}
    <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
    <path d="M8 9h8M8 13h5" />
  {:else if name === 'star'}
    <path d="m12 3.6 2.6 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.4l-5.3 2.9 1.1-6.1L3.3 10l6.1-.8Z" />
  {:else if name === 'github'}
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.37-3.37-1.37-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
    />
  {/if}
</svg>

<style>
  .icon {
    display: block;
    flex: 0 0 auto;
    overflow: visible;
  }
</style>
