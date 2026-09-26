<script lang="ts">
  import { alienData } from '../data';
  import { formatArchiveDate, GAME_VERSION } from '../app-meta';
  import { pathFor } from '../routing';
  import type { ViewId } from '../types';
  import Icon from './Icon.svelte';
  import RaceGlyph from './RaceGlyph.svelte';

  export let activeView: ViewId;
  /** Set by the router; intercepts clicks for instant SPA navigation. */
  export let onNavigate: (view: ViewId) => void = () => undefined;

  const navItems: Array<{ id: ViewId; label: string; icon: 'message' | 'translate' | 'book' }> = [
    { id: 'npc', label: 'NPC Dialogue', icon: 'message' },
    { id: 'translate', label: 'Translate', icon: 'translate' },
    { id: 'phrasebook', label: 'Phrasebook', icon: 'book' },
  ];

  const lastSync = formatArchiveDate(alienData.generatedUtc);
</script>

<header class="topbar">
  <a
    class="brand"
    href={pathFor('translate')}
    onclick={(event) => {
      event.preventDefault();
      onNavigate('translate');
    }}
    aria-label="Open translator"
  >
    <span class="brand-mark"><RaceGlyph race="Atlas" size={42} strokeWidth={2} /></span>
    <span class="brand-copy">
      <strong>No Man's Sky</strong>
      <span>Translator</span>
    </span>
  </a>

  <nav class="main-nav" aria-label="Primary navigation">
    {#each navItems as item}
      <a
        href={pathFor(item.id)}
        class:active={activeView === item.id}
        aria-current={activeView === item.id ? 'page' : undefined}
        onclick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate(item.id);
        }}
      >
        <Icon name={item.icon} size={17} />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="system-status">
    <span class="status-orbit"><i></i></span>
    <span>
      <small>Local archive</small>
      <strong>Online</strong>
    </span>
  </div>
</header>

<div class="status-strip" aria-label="Archive sync status">
  <span class="last-sync">
    <small>Last sync</small>
    <em>{lastSync}</em>
    <i></i>
    <em>{GAME_VERSION}</em>
  </span>
</div>

<style>
  .topbar {
    position: relative;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(250px, 1fr) auto minmax(210px, 1fr);
    align-items: stretch;
    min-height: 82px;
    border-bottom: 2px solid var(--signal-yellow);
    background: linear-gradient(180deg, rgba(4, 9, 21, .96), rgba(5, 10, 22, .72));
    box-shadow: 0 8px 25px rgba(0, 0, 0, .22);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    padding: 0 32px;
    border: 0;
    color: var(--text-primary);
    background: transparent;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 50px;
    height: 50px;
    color: var(--signal-yellow);
    border: 1px solid rgba(255, 216, 75, .4);
    clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
    background: rgba(255, 216, 75, .05);
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1;
    text-transform: uppercase;
  }

  .brand-copy strong {
    font-size: 1.12rem;
    font-weight: 500;
    letter-spacing: .12em;
  }

  .brand-copy span {
    margin-top: 7px;
    color: var(--text-muted);
    font-size: .77rem;
    letter-spacing: .38em;
  }

  .main-nav {
    display: flex;
    align-items: stretch;
    justify-content: center;
    min-width: 0;
  }

  .main-nav a {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 142px;
    padding: 0 24px;
    border: 0;
    color: rgba(230, 237, 242, .68);
    background: transparent;
    font: inherit;
    font-size: .8rem;
    font-weight: 500;
    letter-spacing: .14em;
    text-decoration: none;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
  }

  .main-nav a::after {
    content: '';
    position: absolute;
    left: 20%;
    right: 20%;
    bottom: 0;
    height: 2px;
    background: var(--signal-yellow);
    transform: scaleX(0);
    transition: transform 160ms ease;
  }

  .main-nav a:hover {
    color: #fff;
    background: rgba(255, 255, 255, .025);
  }

  .main-nav a.active {
    color: #11131b;
    background: var(--signal-yellow);
  }

  .main-nav a.active::after {
    transform: scaleX(1);
  }

  .system-status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 11px;
    padding: 0 32px;
    color: var(--signal-cyan);
    text-transform: uppercase;
  }

  .system-status > span:last-child {
    display: flex;
    flex-direction: column;
    line-height: 1.05;
  }

  .system-status small {
    color: var(--text-dim);
    font-size: .57rem;
    letter-spacing: .22em;
  }

  .system-status strong {
    margin-top: 6px;
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .18em;
  }

  .status-orbit {
    position: relative;
    display: block;
    width: 27px;
    height: 27px;
    border: 1px solid rgba(93, 221, 235, .45);
    border-radius: 50%;
  }

  .status-orbit::before {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background: var(--signal-cyan);
    box-shadow: 0 0 9px var(--signal-cyan);
  }

  .status-orbit i {
    position: absolute;
    left: 50%;
    top: -3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #fff;
    transform-origin: 0 16px;
    animation: orbit 4s linear infinite;
  }

  .status-strip {
    position: relative;
    z-index: 19;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 30px;
    padding: 0 32px;
    border-bottom: 1px solid rgba(111, 203, 219, .2);
    background: linear-gradient(90deg, rgba(16, 68, 82, .34), rgba(5, 12, 24, .55) 60%, rgba(4, 9, 20, .62));
    font-family: var(--font-body);
  }

  .last-sync {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    text-transform: uppercase;
  }

  .last-sync small {
    color: var(--text-dim);
    font-size: .64rem;
    font-weight: 700;
    letter-spacing: .18em;
  }

  .last-sync em {
    color: var(--text-primary);
    font-size: .66rem;
    font-style: normal;
    font-weight: 600;
    letter-spacing: .1em;
  }

  .last-sync i {
    width: 1px;
    height: 12px;
    background: rgba(147, 167, 180, .45);
  }

  @keyframes orbit {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 1040px) {
    .topbar {
      grid-template-columns: auto 1fr auto;
    }

    .brand {
      padding: 0 18px;
    }

    .brand-copy span {
      display: none;
    }

    .main-nav a {
      min-width: auto;
      padding: 0 16px;
    }

    .system-status {
      padding: 0 18px;
    }

    .system-status small,
    .system-status > span:last-child {
      display: none;
    }

    .status-strip {
      padding: 0 18px;
    }
  }

  @media (max-width: 760px) {
    .topbar {
      display: flex;
      min-height: 62px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .topbar::-webkit-scrollbar {
      display: none;
    }

    .brand {
      flex: 0 0 auto;
    }

    .brand-mark {
      width: 42px;
      height: 42px;
    }

    .brand-copy {
      display: none;
    }

    .main-nav {
      flex: 1 0 auto;
      justify-content: flex-start;
    }

    .main-nav a {
      min-width: 106px;
      padding: 0 12px;
      font-size: .66rem;
    }

    .system-status {
      display: none;
    }

    .status-strip {
      min-height: 28px;
      padding: 0 12px;
    }
  }
</style>
