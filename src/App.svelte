<script lang="ts">
  import { onMount } from 'svelte';
  import { alienData } from './lib/data';
  import PAGE_META from './lib/pages.json';
  import { loadSession, pathFor, resolveRace, resolveView, saveSession } from './lib/routing';
  import type { RaceName, ViewId } from './lib/types';
  import DataView from './lib/components/DataView.svelte';
  import NpcView from './lib/components/NpcView.svelte';
  import PhrasebookView from './lib/components/PhrasebookView.svelte';
  import SpaceBackdrop from './lib/components/SpaceBackdrop.svelte';
  import TopBar from './lib/components/TopBar.svelte';
  import TranslateView from './lib/components/TranslateView.svelte';

  const RACE_NAMES = alienData.races.map((race) => race.name);
  const META = PAGE_META as Array<{ id: ViewId; title: string; description: string }>;

  let activeView: ViewId = 'translate';
  let selectedRace: RaceName = 'Gek';
  let cursorX = -100;
  let cursorY = -100;
  let cursorVisible = false;
  let locationReady = false;
  let draftText = '';
  let draftDirection: 'alien-to-english' | 'english-to-alien' = 'alien-to-english';

  onMount(() => {
    const initial = resolveView(window.location);
    const session = loadSession();

    activeView = initial;
    selectedRace =
      resolveRace(session?.race ?? null, RACE_NAMES) ??
      resolveRace(new URLSearchParams(window.location.search).get('race'), RACE_NAMES) ??
      resolveRace(localStorage.getItem('nmt-race'), RACE_NAMES) ??
      'Gek';

    if (typeof session?.text === 'string') draftText = session.text;
    if (session?.direction) draftDirection = session.direction;

    // Legacy ?view=/?race= links are redirected to their canonical path once.
    const params = new URLSearchParams(window.location.search);
    if (params.has('view') || params.has('race')) {
      window.history.replaceState(null, '', pathFor(activeView));
    }

    const onPopState = () => {
      activeView = resolveView(window.location);
      const paramsNow = new URLSearchParams(window.location.search);
      const race = resolveRace(paramsNow.get('race'), RACE_NAMES);
      if (race) selectedRace = race;
      syncHead(activeView);
    };

    window.addEventListener('popstate', onPopState);
    locationReady = true;

    return () => window.removeEventListener('popstate', onPopState);
  });

  // Keep the stored session in sync so a hard reload / real page navigation
  // restores the user's text, selected species and direction.
  $: if (locationReady) {
    localStorage.setItem('nmt-race', selectedRace);
    saveSession({ race: selectedRace, text: draftText, direction: draftDirection });
  }

  /**
   * Instant SPA navigation changes the URL but never re-downloads the bundle,
   * so the document head has to be re-pointed to match the HTML that a full
   * page load of this route would have served.
   */
  function syncHead(view: ViewId) {
    const meta = META.find((entry) => entry.id === view);
    if (!meta) return;
    document.title = meta.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = new URL(pathFor(view), window.location.origin).href;
  }

  function navigate(view: ViewId) {
    if (view === activeView) return;
    activeView = view;
    window.history.pushState(null, '', pathFor(view));
    window.scrollTo(0, 0);
    syncHead(view);
  }

  function handlePointerMove(event: PointerEvent) {
    cursorX = event.clientX;
    cursorY = event.clientY;
    cursorVisible = true;
  }
</script>

<svelte:window onpointermove={handlePointerMove} onpointerleave={() => (cursorVisible = false)} />

{#if activeView === 'npc'}
  <NpcView bind:selectedRace onExit={() => navigate('translate')} />
{:else}
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
    <TopBar bind:activeView onNavigate={navigate} />

    <main class="main-content">
      {#key activeView}
        <div class="view-container">
          {#if activeView === 'translate'}
            <TranslateView
              bind:selectedRace
              bind:sourceText={draftText}
              bind:direction={draftDirection}
            />
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
{/if}
