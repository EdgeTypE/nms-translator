<script lang="ts">
  import { onMount } from 'svelte';
  import { alienData } from './lib/data';
  import PAGE_META from './lib/pages.json';
  import { loadSession, pathFor, resolveRace, resolveView, saveSession } from './lib/routing';
import { phrasebookLookup } from './lib/stores/lookup';
  import type { RaceName, ViewId } from './lib/types';
  import AboutDialog from './lib/components/AboutDialog.svelte';
  import Icon from './lib/components/Icon.svelte';
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

  let notFound = false;

  /**
   * The About dialog lives here rather than in either view because the footer
   * that triggers it lives here, and because it must close on navigation: the
   * dialog is a layer over whichever view is mounted, so letting it survive a
   * route change would leave the About text floating over the new view.
   */
  let aboutOpen = false;

  onMount(() => {
    const initial = resolveView(window.location);
    const session = loadSession();

    selectedRace =
      resolveRace(session?.race ?? null, RACE_NAMES) ??
      resolveRace(new URLSearchParams(window.location.search).get('race'), RACE_NAMES) ??
      resolveRace(localStorage.getItem('nmt-race'), RACE_NAMES) ??
      'Gek';

    if (typeof session?.text === 'string') draftText = session.text;
    if (session?.direction) draftDirection = session.direction;

    const params = new URLSearchParams(window.location.search);

    if (!initial) {
      // No static document exists for this path — a genuine 404.
      notFound = true;
      locationReady = true;
      return;
    }

    activeView = initial;

    // Legacy ?view=/?race= links are redirected to their canonical path once.
    if (params.has('view') || params.has('race')) {
      window.history.replaceState(null, '', pathFor(activeView));
    }

    const onPopState = () => {
      const next = resolveView(window.location);
      if (!next) {
        notFound = true;
        return;
      }
      notFound = false;
      activeView = next;
      const paramsNow = new URLSearchParams(window.location.search);
      const race = resolveRace(paramsNow.get('race'), RACE_NAMES);
      if (race) selectedRace = race;
      syncHead(next);
    };

    window.addEventListener('popstate', onPopState);
    locationReady = true;

    return () => window.removeEventListener('popstate', onPopState);
  });

  // Note: GitHub Pages serves a real 404 status for unmatched paths before any
  // JavaScript runs, because no document exists for them. The client only needs
  // to render a sensible "not found" view instead of silently showing the app.

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
    if (view === activeView && !notFound) return;
    aboutOpen = false;
    notFound = false;
    activeView = view;
    window.history.pushState(null, '', pathFor(view));
    window.scrollTo(0, 0);
    syncHead(view);
  }

  /** Opens the phrasebook already filtered to a word from the translator. */
  function lookupWord(word: string) {
    phrasebookLookup.set(word);
    navigate('phrasebook');
  }

  function handlePointerMove(event: PointerEvent) {
    cursorX = event.clientX;
    cursorY = event.clientY;
    cursorVisible = true;
  }

  function openAbout() {
    aboutOpen = true;
  }

  function closeAbout() {
    aboutOpen = false;
  }
</script>

<svelte:window onpointermove={handlePointerMove} onpointerleave={() => (cursorVisible = false)} />

{#if notFound}
  <div class="app-shell">
    <TopBar bind:activeView onNavigate={navigate} />
    <main class="not-found">
      <span class="eyebrow">Error / 404</span>
      <h1>Signal not found</h1>
      <p>
        There is no page at <code>{typeof window === 'undefined' ? '' : window.location.pathname}</code>.
        The translator and phrasebook are still online.
      </p>
      <button type="button" onclick={() => navigate('translate')}>
        Back to translator
        <Icon name="arrow-right" size={18} />
      </button>
    </main>
  </div>
{:else if activeView === 'npc'}
  <NpcView bind:selectedRace onExit={() => navigate('translate')} />
{:else}
  <SpaceBackdrop />

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
              onLookup={lookupWord}
              onOpenNpc={() => navigate('npc')}
            />
          {:else}
            <PhrasebookView bind:selectedRace />
          {/if}
        </div>
      {/key}
    </main>

    <footer class="site-footer">
      <span class="footer-legal">
        Unofficial fan project. Not approved, endorsed or affiliated with
        Hello Games or No Man's Sky.
      </span>
      <a
        class="footer-github"
        href="https://github.com/edgetype/nms-translator"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="github" size={13} strokeWidth={1.6} />
        <span>github.com/edgetype/nms-translator</span>
      </a>
      <button class="footer-about" type="button" onclick={openAbout} aria-haspopup="dialog">
        <Icon name="info" size={13} />
        <span>About</span>
      </button>
    </footer>
  </div>
{/if}

<!--
  Hoisted out of the branches above, so it covers whichever view is mounted
  instead of only the one that triggered it: the notices apply to the site, not
  to a route, and the dialog must not be torn down and rebuilt by a navigation
  that navigate() has already closed it for.

  Only reachable from the footer, which renders on the two real views. The 404
  page has no footer, so a visitor who lands on a dead link cannot reach it -
  worth knowing, since that page is where a stray link most often ends up.
-->
{#if aboutOpen}
  <AboutDialog onClose={closeAbout} />
{/if}

<!-- NPC mode draws its own reticle, so the global one is skipped there. It is
     hoisted out of the branches above so the 404 view keeps a pointer too
     (the native cursor is suppressed site-wide, so a missing reticle here
     would leave that page with no cursor at all). -->
{#if activeView !== 'npc'}
  <div
    class="cursor-reticle"
    class:visible={cursorVisible}
    style={`transform: translate(${cursorX}px, ${cursorY}px)`}
    aria-hidden="true"
  ></div>
{/if}

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: calc(100svh - 145px);
    padding: 40px 24px;
    text-align: center;
  }

  .not-found .eyebrow {
    color: var(--signal-yellow);
    font-family: var(--font-body);
    font-size: .68rem;
    font-weight: 600;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  .not-found h1 {
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 300;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .not-found p {
    max-width: 34rem;
    margin: 0;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: .9rem;
    line-height: 1.6;
  }

  .not-found code {
    color: var(--signal-cyan);
    font-family: var(--font-body);
    font-size: .85rem;
  }

  .not-found button {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    margin-top: 6px;
    padding: 0 22px;
    border: 0;
    color: #0b1018;
    background: var(--signal-yellow);
    font: inherit;
    font-size: .74rem;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
    cursor: pointer;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 10px 50%);
  }

  .not-found button:hover {
    background: #ffe76c;
  }
</style>
