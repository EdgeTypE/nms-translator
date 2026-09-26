<script lang="ts">
  import { onMount } from 'svelte';
  import { alienData } from './lib/data';
  import type { RaceName, ViewId } from './lib/types';
  import DataView from './lib/components/DataView.svelte';
  import PhrasebookView from './lib/components/PhrasebookView.svelte';
  import SpaceBackdrop from './lib/components/SpaceBackdrop.svelte';
  import TopBar from './lib/components/TopBar.svelte';
  import TranslateView from './lib/components/TranslateView.svelte';

  let activeView: ViewId = 'translate';
  let selectedRace: RaceName = 'Gek';
  let cursorX = -100;
  let cursorY = -100;
  let cursorVisible = false;
  let locationReady = false;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view') as ViewId | null;
    const requestedRace = params.get('race') as RaceName | null;
    const storedRace = window.localStorage.getItem('nmt-race') as RaceName | null;

    if (requestedView && ['translate', 'phrasebook', 'data'].includes(requestedView)) {
      activeView = requestedView;
    }
    if (requestedRace && alienData.races.some((race) => race.name === requestedRace)) {
      selectedRace = requestedRace;
    } else if (storedRace && alienData.races.some((race) => race.name === storedRace)) {
      selectedRace = storedRace;
    }
    locationReady = true;
  });

  $: if (typeof window !== 'undefined' && locationReady) {
    window.localStorage.setItem('nmt-race', selectedRace);
    const url = new URL(window.location.href);
    url.searchParams.set('view', activeView);
    window.history.replaceState(null, '', url);
  }

  function handlePointerMove(event: PointerEvent) {
    cursorX = event.clientX;
    cursorY = event.clientY;
    cursorVisible = true;
  }
</script>

<svelte:head>
  <meta property="og:title" content="No Man's Sky Translator" />
  <meta
    property="og:description"
    content="Translate every major No Man's Sky alien language locally in your browser."
  />
</svelte:head>

<svelte:window onpointermove={handlePointerMove} onpointerleave={() => (cursorVisible = false)} />

<SpaceBackdrop />
<div
  class="cursor-reticle"
  class:visible={cursorVisible}
  style={`left: ${cursorX}px; top: ${cursorY}px`}
  aria-hidden="true"
>
  <i></i>
</div>

<div class="app-shell">
  <TopBar
    bind:activeView
    entryCount={alienData.counts.includedEntries}
    raceCount={alienData.races.length}
  />

  <main class="main-content">
    {#key activeView}
      <div class="view-container">
        {#if activeView === 'translate'}
          <TranslateView bind:selectedRace />
        {:else if activeView === 'phrasebook'}
          <PhrasebookView bind:selectedRace />
        {:else}
          <DataView />
        {/if}
      </div>
    {/key}
  </main>

  <footer class="site-footer">
    <span>UNOFFICIAL FAN UTILITY / NOT AFFILIATED WITH HELLGAME GAMES</span>
    <span class="footer-center">
      <kbd>Ctrl</kbd><b>+</b><kbd>Enter</kbd>
      Translate
      <i></i>
      <kbd>Esc</kbd>
      Clear
    </span>
    <span>NO REMOTE API / BROWSER LOCAL</span>
  </footer>
</div>
