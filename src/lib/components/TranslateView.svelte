<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { alienData, translationEngine } from '../data';
  import { RACE_META } from '../races';
  import type {
    RaceName,
    TranslationDirection,
    TranslationResult,
    AlienEntry,
  } from '../types';
  import Icon from './Icon.svelte';
  import RaceGlyph from './RaceGlyph.svelte';

  export let selectedRace: RaceName = 'Gek';

  let direction: TranslationDirection = 'alien-to-english';
  let sourceText = '';
  let translation: TranslationResult | null = null;
  let isTranslating = false;
  let copied = false;
  let translationTimer: number | undefined;
  let copyTimer: number | undefined;

  $: raceMeta = RACE_META[selectedRace];
  $: raceEntries = translationEngine.getEntries(selectedRace);
  $: raceCount = raceEntries.length;
  $: signalEntries = pickSignalEntries(raceEntries);
  $: sourceLanguage = direction === 'alien-to-english' ? selectedRace : 'English';
  $: targetLanguage = direction === 'alien-to-english' ? 'English' : selectedRace;
  $: matchPercent = translation?.coverage ?? 0;

  onMount(() => {
    sourceText = createExample(selectedRace, false);
    translation = translateNow();
  });

  onDestroy(() => {
    if (translationTimer) window.clearTimeout(translationTimer);
    if (copyTimer) window.clearTimeout(copyTimer);
  });

  function pickSignalEntries(entries: AlienEntry[]) {
    const preferred = ['hello', 'traveller', 'friend', 'welcome', 'thank', 'you', 'ship', 'space'];
    const byEnglish = new Map(entries.map((entry) => [entry.english.toLocaleLowerCase('en'), entry]));
    const chosen = preferred
      .map((word) => byEnglish.get(word))
      .filter((entry): entry is AlienEntry => Boolean(entry))
      .slice(0, 4);

    if (chosen.length >= 4) return chosen;

    const seen = new Set(chosen.map((entry) => entry.english));
    const fallback = [...entries]
      .sort((a, b) => b.frequency - a.frequency || a.sourceIndex - b.sourceIndex)
      .filter((entry) => !seen.has(entry.english));

    return [...chosen, ...fallback].slice(0, 4);
  }

  function createExample(race: RaceName, randomize: boolean) {
    const entries = pickSignalEntries(translationEngine.getEntries(race));
    if (randomize) entries.sort(() => Math.random() - 0.5);
    return entries.map((entry) => entry.surface).join(' ');
  }

  function translateNow() {
    if (!sourceText.trim()) return null;
    return translationEngine.translate(sourceText, direction, selectedRace);
  }

  function requestTranslation() {
    if (!sourceText.trim()) {
      translation = null;
      return;
    }

    isTranslating = true;
    if (translationTimer) window.clearTimeout(translationTimer);
    translationTimer = window.setTimeout(() => {
      translation = translateNow();
      isTranslating = false;
    }, 180);
  }

  function handleInput() {
    translation = null;
  }

  function setDirection(nextDirection: TranslationDirection) {
    if (direction === nextDirection) return;
    direction = nextDirection;
    sourceText = createExample(selectedRace, false);
    translation = translateNow();
  }

  function selectRace(race: RaceName) {
    selectedRace = race;
    sourceText = createExample(race, false);
    translation = translateNow();
  }

  function swapLanguages() {
    const carriedText = translation?.output || sourceText;
    direction = direction === 'alien-to-english' ? 'english-to-alien' : 'alien-to-english';
    sourceText = carriedText;
    translation = translateNow();
  }

  function clearAll() {
    sourceText = '';
    translation = null;
  }

  function randomExample() {
    sourceText = createExample(selectedRace, true);
    translation = translateNow();
  }

  function useSignal(entry: AlienEntry) {
    sourceText = direction === 'alien-to-english' ? entry.surface : entry.english;
    translation = translateNow();
  }

  async function copyTranslation() {
    if (!translation?.output) return;

    try {
      await navigator.clipboard.writeText(translation.output);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = translation.output;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    copied = true;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (copied = false), 1600);
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      requestTranslation();
    }
    if (event.key === 'Escape') clearAll();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="translate-view view-enter" aria-labelledby="translator-title">
  <aside class="language-rail" aria-label="Language controls">
    <div class="rail-heading">
      <span class="eyebrow">01 / Translation array</span>
      <h2>Communication</h2>
    </div>

    <div class="direction-control">
      <span class="control-label">Direction</span>
      <button
        type="button"
        class:active={direction === 'alien-to-english'}
        onclick={() => setDirection('alien-to-english')}
      >
        <span>Alien</span>
        <Icon name="arrow-right" size={15} />
        <span>English</span>
      </button>
      <button
        type="button"
        class:active={direction === 'english-to-alien'}
        onclick={() => setDirection('english-to-alien')}
      >
        <span>English</span>
        <Icon name="arrow-right" size={15} />
        <span>Alien</span>
      </button>
    </div>

    <div class="race-heading">
      <span class="control-label">Alien species</span>
      <span>{raceCount.toLocaleString('en')} signals</span>
    </div>

    <div class="race-list">
      {#each alienData.races as race, index}
        <button
          type="button"
          class:active={selectedRace === race.name}
          style={`--race-accent: ${RACE_META[race.name].accent}`}
          onclick={() => selectRace(race.name)}
        >
          <span class="race-index">0{index + 1}</span>
          <span class="race-icon"><RaceGlyph race={race.name} size={39} /></span>
          <span class="race-copy">
            <strong>{race.name}</strong>
            <small>{RACE_META[race.name].designation}</small>
          </span>
          <span class="race-signal"><i></i></span>
        </button>
      {/each}
    </div>

    <div class="quick-signals">
      <div class="section-label">
        <span>Quick signals</span>
        <Icon name="sparkles" size={14} />
      </div>
      <div class="signal-list">
        {#each signalEntries as entry}
          <button type="button" onclick={() => useSignal(entry)} title={`Use “${entry.english}”`}>
            <span>{entry.english}</span>
            <small>{entry.surface}</small>
          </button>
        {/each}
      </div>
    </div>
  </aside>

  <div class="translator-stage">
    <header class="stage-header">
      <div>
        <span class="eyebrow">Active channel / {String(raceEntries.length).padStart(4, '0')} indexed entries</span>
        <h1 id="translator-title">{selectedRace} Translation Matrix</h1>
      </div>
      <div class="channel-state" style={`--race-accent: ${raceMeta.accent}`}>
        <RaceGlyph race={selectedRace} size={47} />
        <span>
          <small>Signal profile</small>
          <strong>{raceMeta.speechModel}</strong>
        </span>
        <i></i>
      </div>
    </header>

    <div class="translation-grid">
      <section class="translation-panel source-panel" aria-labelledby="source-title">
        <header>
          <span class="panel-index">A</span>
          <div>
            <small>Source transmission</small>
            <h2 id="source-title">{sourceLanguage}</h2>
          </div>
          <span class="language-code">{sourceLanguage === 'English' ? 'ENG' : selectedRace.slice(0, 3).toUpperCase()}</span>
        </header>

        <div class="input-wrap">
          <textarea
            bind:value={sourceText}
            oninput={handleInput}
            maxlength="280"
            spellcheck="false"
            placeholder="Enter an alien transmission..."
            aria-label={`${sourceLanguage} source text`}
          ></textarea>
          <span class="corner corner-tl"></span>
          <span class="corner corner-br"></span>
        </div>

        <footer>
          <span>{sourceText.length} / 280 characters</span>
          <span class="input-mode"><i></i> Local lexicon</span>
        </footer>
      </section>

      <button
        class="swap-button"
        type="button"
        onclick={swapLanguages}
        aria-label="Swap translation direction"
        title="Swap languages"
      >
        <Icon name="shuffle" size={21} />
      </button>

      <section class="translation-panel output-panel" class:is-loading={isTranslating} aria-labelledby="output-title">
        <header>
          <span class="panel-index">B</span>
          <div>
            <small>Decoded output</small>
            <h2 id="output-title">{targetLanguage}</h2>
          </div>
          <span class="language-code output-code">{targetLanguage === 'English' ? 'ENG' : selectedRace.slice(0, 3).toUpperCase()}</span>
        </header>

        <div class="output-wrap" aria-live="polite" aria-busy={isTranslating}>
          {#if isTranslating}
            <div class="decoding-state">
              <span></span><span></span><span></span><span></span>
              <small>Decoding signal</small>
            </div>
          {:else if translation}
            <div class="result-copy">
              {#each translation.segments as segment}
                <span
                  class:unknown={segment.status === 'unknown'}
                  class:ambiguous={segment.status === 'ambiguous'}
                  title={segment.alternatives.length ? `Alternatives: ${segment.alternatives.join(', ')}` : undefined}
                >{segment.output}</span>
              {/each}
            </div>
          {:else}
            <div class="empty-output">
              <span class="empty-reticle"><i></i></span>
              <strong>Signal awaiting translation</strong>
              <small>Enter a phrase, then initiate the decoder.</small>
            </div>
          {/if}
        </div>

        <footer>
          {#if translation}
            <span class="coverage"><i style={`width: ${matchPercent}%`}></i></span>
            <span>{translation.matchedTokenCount}/{translation.sourceTokenCount} matched</span>
            <span>{matchPercent}% confidence</span>
          {:else}
            <span>No translation data</span>
            <span>00% confidence</span>
          {/if}
        </footer>
      </section>
    </div>

    {#if translation && (translation.unknownTokenCount > 0 || translation.ambiguousTokenCount > 0)}
      <div class="translation-notices">
        {#if translation.unknownTokenCount > 0}
          <div class="notice warning">
            <Icon name="alert" size={17} />
            <span>
              <strong>{translation.unknownTokenCount} unknown token{translation.unknownTokenCount === 1 ? '' : 's'}</strong>
              <small>{translation.unknownTokens.slice(0, 5).join(' · ')}</small>
            </span>
          </div>
        {/if}
        {#if translation.ambiguousTokenCount > 0}
          <div class="notice info">
            <Icon name="info" size={17} />
            <span>
              <strong>{translation.ambiguousTokenCount} ambiguous match{translation.ambiguousTokenCount === 1 ? '' : 'es'}</strong>
              <small>Alternate meanings are preserved in the phrasebook.</small>
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="action-bar">
      <div class="action-group secondary-actions">
        <button type="button" onclick={randomExample}>
          <Icon name="sparkles" size={16} />
          Random example
        </button>
        <button type="button" onclick={clearAll}>
          <Icon name="trash" size={16} />
          Clear
        </button>
        <button type="button" class:active={copied} onclick={copyTranslation} disabled={!translation?.output}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          {copied ? 'Copied' : 'Copy result'}
        </button>
      </div>

      <button class="translate-button" type="button" onclick={requestTranslation} disabled={!sourceText.trim()}>
        <span>{isTranslating ? 'Decoding' : 'Translate'}</span>
        <small>Ctrl + Enter</small>
        <Icon name="arrow-right" size={22} />
      </button>
    </div>
  </div>
</section>

<style>
  .translate-view {
    display: grid;
    grid-template-columns: minmax(250px, 25vw) minmax(0, 1fr);
    min-height: calc(100svh - 114px);
  }

  .language-rail {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 34px 24px 24px 32px;
    border-right: 1px solid rgba(116, 196, 212, .2);
    background: linear-gradient(90deg, rgba(3, 8, 19, .64), rgba(3, 8, 19, .2));
  }

  .rail-heading {
    margin-bottom: 25px;
  }

  .eyebrow,
  .control-label {
    display: block;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    font-weight: 600;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
  }

  .rail-heading h2,
  .stage-header h1 {
    margin-top: 8px;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-weight: 300;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .rail-heading h2 {
    font-size: 1.55rem;
  }

  .direction-control {
    position: relative;
    display: grid;
    gap: 5px;
    margin-bottom: 25px;
  }

  .direction-control .control-label {
    margin-bottom: 4px;
  }

  .direction-control button {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid rgba(112, 193, 209, .17);
    color: var(--text-muted);
    background: rgba(8, 18, 34, .48);
    font: inherit;
    font-size: .7rem;
    letter-spacing: .09em;
    text-transform: uppercase;
    cursor: pointer;
    transition: 150ms ease;
  }

  .direction-control button span:last-child {
    text-align: right;
  }

  .direction-control button:hover {
    color: #fff;
    border-color: rgba(112, 193, 209, .45);
  }

  .direction-control button.active {
    color: #091018;
    border-color: var(--signal-yellow);
    background: var(--signal-yellow);
  }

  .race-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px 9px 0;
    border-bottom: 1px solid rgba(112, 193, 209, .14);
  }

  .race-heading > span:last-child {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .58rem;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .race-list {
    display: grid;
    gap: 4px;
    margin: 8px -24px 0 -32px;
  }

  .race-list > button {
    position: relative;
    display: grid;
    grid-template-columns: 28px 46px 1fr auto;
    align-items: center;
    gap: 9px;
    min-height: 63px;
    padding: 7px 18px 7px 13px;
    overflow: hidden;
    border: 0;
    border-left: 3px solid transparent;
    color: var(--text-muted);
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: 150ms ease;
  }

  .race-list > button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, color-mix(in srgb, var(--race-accent) 15%, transparent), transparent 78%);
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .race-list > button:hover {
    color: #fff;
    background: rgba(105, 202, 219, .04);
  }

  .race-list > button:hover::after,
  .race-list > button.active::after {
    opacity: 1;
  }

  .race-list > button.active {
    color: #fff;
    border-left-color: var(--signal-yellow);
    background: linear-gradient(90deg, rgba(176, 31, 71, .86), rgba(103, 24, 57, .55));
    box-shadow: inset 0 0 35px rgba(244, 57, 101, .06);
  }

  .race-index,
  .race-icon,
  .race-copy,
  .race-signal {
    position: relative;
    z-index: 1;
  }

  .race-index {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .55rem;
    letter-spacing: .12em;
  }

  .race-icon {
    color: var(--race-accent);
  }

  .race-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .race-copy strong {
    font-size: .92rem;
    font-weight: 400;
    letter-spacing: .05em;
  }

  .race-copy small {
    margin-top: 3px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .5rem;
    letter-spacing: .14em;
  }

  .race-signal {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border: 1px solid rgba(125, 207, 220, .25);
    transform: rotate(45deg);
  }

  .race-signal i {
    width: 4px;
    height: 4px;
    background: var(--race-accent);
    box-shadow: 0 0 7px var(--race-accent);
    opacity: .35;
  }

  .race-list > button.active .race-signal {
    border-color: var(--signal-yellow);
  }

  .race-list > button.active .race-signal i {
    background: var(--signal-yellow);
    opacity: 1;
  }

  .quick-signals {
    margin-top: auto;
    padding-top: 22px;
  }

  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 3px 8px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .58rem;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .signal-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .signal-list button {
    min-width: 0;
    padding: 8px 9px;
    border: 1px solid rgba(105, 202, 219, .14);
    color: var(--text-muted);
    background: rgba(6, 13, 27, .48);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: 140ms ease;
  }

  .signal-list button:hover {
    color: #fff;
    border-color: rgba(105, 202, 219, .4);
  }

  .signal-list span,
  .signal-list small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .signal-list span {
    font-size: .68rem;
    letter-spacing: .04em;
  }

  .signal-list small {
    margin-top: 2px;
    color: var(--signal-cyan);
    font-size: .62rem;
  }

  .translator-stage {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 34px clamp(28px, 4vw, 68px) 24px;
  }

  .stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 26px;
  }

  .stage-header h1 {
    font-size: clamp(1.45rem, 2.2vw, 2.15rem);
  }

  .channel-state {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
    padding: 8px 14px 8px 10px;
    border: 1px solid rgba(112, 193, 209, .17);
    color: var(--race-accent);
    background: rgba(5, 13, 27, .45);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  }

  .channel-state span {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }

  .channel-state small {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .53rem;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .channel-state strong {
    margin-top: 7px;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: .78rem;
    font-weight: 400;
    letter-spacing: .11em;
    text-transform: uppercase;
  }

  .channel-state > i {
    width: 6px;
    height: 6px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--race-accent);
    box-shadow: 0 0 8px var(--race-accent);
  }

  .translation-grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 26px;
  }

  .translation-panel {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(210px, 1fr) auto;
    min-width: 0;
    min-height: 315px;
    border: 1px solid rgba(116, 196, 212, .19);
    background: linear-gradient(145deg, rgba(6, 14, 29, .76), rgba(3, 8, 19, .45));
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
    transition: border-color 160ms ease, background 160ms ease;
  }

  .translation-panel:focus-within {
    border-color: rgba(95, 219, 233, .52);
    background: linear-gradient(145deg, rgba(7, 20, 38, .88), rgba(3, 9, 20, .55));
  }

  .translation-panel > header {
    display: grid;
    grid-template-columns: 34px 1fr auto;
    align-items: center;
    gap: 11px;
    min-height: 67px;
    padding: 0 20px;
    border-bottom: 1px solid rgba(116, 196, 212, .18);
  }

  .panel-index {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: #091018;
    background: var(--signal-yellow);
    font-family: var(--font-body);
    font-size: .7rem;
    font-weight: 700;
    clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  }

  .translation-panel header div {
    display: flex;
    flex-direction: column;
  }

  .translation-panel header small {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .53rem;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .translation-panel header h2 {
    margin-top: 3px;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .language-code {
    color: var(--signal-cyan);
    font-family: var(--font-body);
    font-size: .59rem;
    letter-spacing: .17em;
  }

  .output-code {
    color: var(--signal-yellow);
  }

  .input-wrap,
  .output-wrap {
    position: relative;
    min-width: 0;
  }

  textarea {
    width: 100%;
    height: 100%;
    min-height: 210px;
    resize: none;
    padding: 26px 25px;
    border: 0;
    outline: 0;
    color: var(--text-primary);
    background: transparent;
    font-family: var(--font-heading);
    font-size: clamp(1.2rem, 1.8vw, 1.75rem);
    font-weight: 300;
    line-height: 1.55;
    letter-spacing: .025em;
    caret-color: var(--signal-yellow);
  }

  textarea::placeholder {
    color: rgba(159, 180, 194, .26);
  }

  .corner {
    position: absolute;
    width: 12px;
    height: 12px;
    pointer-events: none;
  }

  .corner-tl {
    left: 9px;
    top: 9px;
    border-left: 1px solid rgba(91, 216, 231, .28);
    border-top: 1px solid rgba(91, 216, 231, .28);
  }

  .corner-br {
    right: 9px;
    bottom: 9px;
    border-right: 1px solid rgba(91, 216, 231, .28);
    border-bottom: 1px solid rgba(91, 216, 231, .28);
  }

  .translation-panel > footer {
    display: flex;
    align-items: center;
    gap: 13px;
    min-height: 36px;
    padding: 0 20px;
    border-top: 1px solid rgba(116, 196, 212, .12);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .56rem;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .translation-panel > footer span:last-child {
    margin-left: auto;
  }

  .input-mode {
    color: #8cd8c0;
  }

  .input-mode i,
  .coverage i {
    display: inline-block;
    width: 5px;
    height: 5px;
    margin-right: 5px;
    border-radius: 50%;
    background: #76e3ba;
    box-shadow: 0 0 6px #76e3ba;
  }

  .coverage {
    position: relative;
    width: 52px;
    height: 3px;
    overflow: hidden;
    background: rgba(255, 255, 255, .08);
  }

  .coverage i {
    position: absolute;
    inset: 0 auto 0 0;
    width: 0;
    margin: 0;
    border-radius: 0;
    background: var(--signal-yellow);
    box-shadow: 0 0 6px var(--signal-yellow);
    transition: width 260ms ease;
  }

  .output-wrap {
    display: flex;
    align-items: center;
    min-height: 210px;
    padding: 24px 25px;
    overflow: auto;
  }

  .result-copy {
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: clamp(1.2rem, 1.8vw, 1.75rem);
    font-weight: 300;
    line-height: 1.55;
    letter-spacing: .025em;
  }

  .result-copy span.unknown {
    color: #ff8f82;
    text-decoration: underline dotted rgba(255, 143, 130, .55);
    text-underline-offset: 4px;
  }

  .result-copy span.ambiguous {
    color: #f5d479;
    border-bottom: 1px dotted rgba(245, 212, 121, .55);
  }

  .empty-output {
    display: grid;
    justify-items: center;
    gap: 9px;
    width: 100%;
    color: var(--text-dim);
    text-align: center;
  }

  .empty-output strong {
    color: rgba(198, 212, 222, .52);
    font-size: .8rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .empty-output small {
    font-family: var(--font-body);
    font-size: .63rem;
    letter-spacing: .07em;
  }

  .empty-reticle {
    position: relative;
    display: grid;
    place-items: center;
    width: 47px;
    height: 47px;
    margin-bottom: 5px;
    border: 1px solid rgba(111, 204, 219, .26);
    border-radius: 50%;
  }

  .empty-reticle::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--signal-cyan);
    box-shadow: 0 0 8px var(--signal-cyan);
    opacity: .55;
  }

  .empty-reticle i {
    position: absolute;
    inset: -9px;
    border-top: 1px solid rgba(111, 204, 219, .25);
    border-radius: 50%;
  }

  .decoding-state {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .decoding-state span {
    width: 5px;
    height: 18px;
    background: var(--signal-cyan);
    box-shadow: 0 0 7px rgba(91, 216, 231, .55);
    animation: decode 800ms ease-in-out infinite alternate;
  }

  .decoding-state span:nth-child(2) { animation-delay: 120ms; }
  .decoding-state span:nth-child(3) { animation-delay: 240ms; }
  .decoding-state span:nth-child(4) { animation-delay: 360ms; }

  .decoding-state small {
    margin-left: 10px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .6rem;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .swap-button {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    padding: 0;
    border: 1px solid rgba(111, 204, 219, .34);
    border-radius: 50%;
    color: var(--signal-cyan);
    background: #0a1426;
    box-shadow: 0 0 0 7px rgba(4, 10, 22, .86), 0 0 20px rgba(39, 180, 202, .12);
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: 160ms ease;
    z-index: 5;
  }

  .swap-button:hover {
    color: #071018;
    border-color: var(--signal-yellow);
    background: var(--signal-yellow);
    transform: translate(-50%, -50%) rotate(180deg);
  }

  .translation-notices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 48px;
    padding: 8px 14px;
    border: 1px solid rgba(255, 166, 79, .23);
    color: #ffb57c;
    background: rgba(57, 28, 16, .34);
  }

  .notice.info {
    color: #78d9e8;
    border-color: rgba(80, 205, 225, .2);
    background: rgba(6, 40, 49, .3);
  }

  .notice span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .notice strong {
    font-size: .68rem;
    font-weight: 500;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .notice small {
    margin-top: 3px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .59rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-top: auto;
    padding-top: 20px;
  }

  .action-group {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .secondary-actions button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 35px;
    padding: 0 13px;
    border: 1px solid rgba(112, 193, 209, .18);
    color: var(--text-muted);
    background: rgba(5, 13, 27, .52);
    font: inherit;
    font-size: .6rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: 140ms ease;
  }

  .secondary-actions button:hover,
  .secondary-actions button.active {
    color: #fff;
    border-color: rgba(112, 193, 209, .46);
    background: rgba(16, 38, 58, .65);
  }

  .secondary-actions button.active {
    color: #86e7c4;
  }

  .secondary-actions button:disabled {
    opacity: .35;
    cursor: not-allowed;
  }

  .translate-button {
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    gap: 14px;
    min-width: 238px;
    min-height: 54px;
    padding: 0 20px 0 25px;
    border: 0;
    color: #0b1018;
    background: var(--signal-yellow);
    font: inherit;
    text-transform: uppercase;
    clip-path: polygon(0 0, calc(100% - 17px) 0, 100% 50%, calc(100% - 17px) 100%, 0 100%, 12px 50%);
    cursor: pointer;
    box-shadow: 0 0 22px rgba(255, 215, 67, .1);
    transition: 150ms ease;
  }

  .translate-button:hover:not(:disabled) {
    background: #ffe76c;
    box-shadow: 0 0 30px rgba(255, 215, 67, .22);
    transform: translateY(-1px);
  }

  .translate-button:disabled {
    opacity: .42;
    cursor: not-allowed;
  }

  .translate-button span {
    font-size: .8rem;
    font-weight: 700;
    letter-spacing: .16em;
  }

  .translate-button small {
    padding: 4px 6px;
    border: 1px solid rgba(8, 16, 24, .27);
    font-family: var(--font-body);
    font-size: .52rem;
    letter-spacing: .08em;
  }

  @keyframes decode {
    from { transform: scaleY(.35); opacity: .35; }
    to { transform: scaleY(1); opacity: 1; }
  }

  @media (max-width: 1180px) {
    .translate-view {
      grid-template-columns: 240px minmax(0, 1fr);
    }

    .language-rail {
      padding-left: 20px;
    }

    .race-list {
      margin-left: -20px;
    }

    .translation-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .translation-panel {
      min-height: 270px;
      grid-template-rows: auto minmax(170px, 1fr) auto;
    }

    textarea,
    .output-wrap {
      min-height: 170px;
    }

    .swap-button {
      top: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
    }

    .swap-button:hover {
      transform: translate(-50%, -50%) rotate(270deg);
    }
  }

  @media (max-width: 900px) {
    .translate-view {
      display: block;
      width: 100%;
      max-width: 100vw;
    }

    .language-rail {
      width: 100%;
      max-width: 100%;
      border-right: 0;
      border-bottom: 1px solid rgba(116, 196, 212, .18);
    }

    .rail-heading,
    .quick-signals {
      display: none;
    }

    .direction-control {
      grid-template-columns: auto 1fr 1fr;
      align-items: center;
      gap: 7px;
      margin-bottom: 14px;
    }

    .direction-control .control-label {
      margin: 0;
    }

    .direction-control button {
      min-height: 34px;
    }

    .race-heading {
      margin-bottom: 4px;
    }

    .race-list {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      width: 100%;
      max-width: 100%;
      margin: 7px 0 0;
      gap: 4px;
    }

    .race-list > button {
      display: flex;
      width: 100%;
      min-width: 0;
      overflow: hidden;
      flex-direction: column;
      justify-content: center;
      min-height: 76px;
      padding: 7px 4px;
      border-left: 0;
      border-bottom: 2px solid transparent;
      text-align: center;
    }

    .race-list > button.active {
      border-bottom-color: var(--signal-yellow);
    }

    .race-index,
    .race-signal {
      display: none;
    }

    .race-icon {
      display: grid;
      place-items: center;
    }

    .race-copy small {
      display: none;
    }

    .race-copy strong {
      font-size: .7rem;
    }
  }

  @media (max-width: 680px) {
    .direction-control {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }

    .direction-control .control-label {
      grid-column: 1 / -1;
    }

    .direction-control button {
      min-width: 0;
      padding: 0 7px;
      gap: 4px;
      font-size: .58rem;
    }

    .direction-control button span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .translator-stage {
      padding: 24px 14px 18px;
    }

    .stage-header {
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .stage-header h1 {
      font-size: 1.22rem;
    }

    .channel-state {
      min-width: 0;
      padding: 5px;
    }

    .channel-state span,
    .channel-state > i {
      display: none;
    }

    .translation-panel {
      min-height: 250px;
    }

    textarea,
    .output-wrap {
      min-height: 150px;
      padding: 20px 18px;
      font-size: 1.15rem;
    }

    .action-bar {
      align-items: stretch;
      flex-direction: column-reverse;
    }

    .translate-button {
      width: 100%;
      min-height: 48px;
    }

    .secondary-actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }

    .secondary-actions button {
      justify-content: center;
      padding: 0 7px;
      font-size: .53rem;
    }

    .secondary-actions button :global(svg) {
      display: none;
    }
  }
</style>
