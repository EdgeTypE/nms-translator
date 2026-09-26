<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { alienData, translationEngine } from '../data';
  import { NPC_ACCENT } from '../races';
  import { createNpcParallax, type ParallaxController } from '../npc/parallax';
  import { computeStageLayout, type StageLayout } from '../npc/layout';
  import { getNpcPortrait } from '../npc/portraits';
  import { conversationDraft } from '../stores/handoff';
  import type { AlienEntry, RaceName, TranslationDirection, TranslationResult } from '../types';
  import Icon from './Icon.svelte';

  export let selectedRace: RaceName = 'Gek';
  export let onExit: () => void = () => undefined;
  /** Bound to the router so the dialogue survives real page navigations. */
  export let sourceText = '';
  export let direction: TranslationDirection = 'alien-to-english';

  let translation: TranslationResult | null = null;
  let statusOverride = '';
  let userEdited = false;
  let canvas: HTMLCanvasElement;
  let controller: ParallaxController | null = null;
  let canvasReady = false;
  let webglFailed = false;
  let reticleX = -100;
  let reticleY = -100;
  let reticleVisible = false;
  let statusTimer: number | undefined;
  let handoffReady = false;

  let layout: StageLayout = computeStageLayout(
    typeof window === 'undefined' ? 1920 : window.innerWidth,
    typeof window === 'undefined' ? 1080 : window.innerHeight,
  );

  $: portrait = getNpcPortrait(selectedRace);
  $: panelStyle = [
    `left:${layout.panel.left}px`,
    `top:${layout.panel.top}px`,
    `width:${layout.panel.width}px`,
    `height:${layout.panel.height}px`,
  ].join(';');
  $: inputStyle = [
    `left:${layout.panel.left}px`,
    `width:${layout.panel.width}px`,
    `bottom:${layout.inputBottom}px`,
  ].join(';');
  $: optionsStyle = `bottom:${layout.optionsBottom}px`;
  // The panel is masked so its right edge fades out, and a mask clips the
  // element's children to its own box. The speaker tab deliberately overhangs
  // the panel's top edge, so it (and the status readout) are positioned from
  // these variables as siblings of the panel instead of children of it.
  $: panelVars = `--panel-left:${layout.panel.left}px;--panel-top:${layout.panel.top}px`;
  $: statusVars = `${panelVars};--panel-width:${layout.panel.width}px`;
  // Every green in this view is really the species accent, so one inline
  // custom property repaints translated text, the speaker name, the HUD and
  // the interactive highlights when the species changes.
  $: accentStyle = `--npc-accent:${NPC_ACCENT[selectedRace]}`;
  $: speakerTag = direction === 'alien-to-english'
    ? `${selectedRace} Translator`
    : `${selectedRace} Speaker`;
  $: inputPlaceholder = direction === 'alien-to-english'
    ? `Type ${selectedRace} here`
    : 'Type English here';
  $: statusText = statusOverride || (translation
    ? `${translation.matchedTokenCount} / ${translation.sourceTokenCount} WORDS DECODED`
    : 'ENTER TEXT TO TRANSLATE');
  // Keep the shared conversation buffer in sync once this view is live, so
  // exiting back to Translate restores the same text + direction.
  $: if (handoffReady) conversationDraft.set({ text: sourceText, direction });

  function createSample(race: RaceName, nextDirection: TranslationDirection) {
    const entries = translationEngine.getEntries(race);
    const byEnglish = new Map(entries.map((entry) => [entry.english.toLocaleLowerCase('en'), entry]));
    const preferred = ['hello', 'friend', 'traveller', 'ship', 'space'];
    const chosen = preferred
      .map((word) => byEnglish.get(word))
      .filter((entry): entry is AlienEntry => Boolean(entry))
      .slice(0, 3);

    if (chosen.length >= 2) {
      return chosen
        .map((entry) => nextDirection === 'alien-to-english' ? entry.surface : entry.english)
        .join(' ');
    }

    const fallback = [...entries]
      .sort((a, b) => b.frequency - a.frequency || a.sourceIndex - b.sourceIndex)
      .slice(0, 3);

    return fallback
      .map((entry) => nextDirection === 'alien-to-english' ? entry.surface : entry.english)
      .join(' ');
  }

  function translateNow() {
    statusOverride = '';
    if (!sourceText.trim()) {
      translation = null;
      return;
    }
    translation = translationEngine.translate(sourceText, direction, selectedRace);
  }

  function handleRaceChange() {
    if (!userEdited) sourceText = createSample(selectedRace, direction);
    translateNow();
    const nextPortrait = getNpcPortrait(selectedRace);
    controller?.setImages(nextPortrait.color, nextPortrait.depth, nextPortrait.depthRange);
  }

  function setDirection(nextDirection: TranslationDirection) {
    if (direction === nextDirection) return;
    direction = nextDirection;
    if (!userEdited) sourceText = createSample(selectedRace, direction);
    translateNow();
  }

  function handleInput() {
    userEdited = true;
    translateNow();
  }

  async function copyTranslation() {
    if (!translation?.output) return;

    try {
      await navigator.clipboard.writeText(translation.output);
      statusOverride = 'COPIED';
    } catch {
      const helper = document.createElement('textarea');
      helper.value = translation.output;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand('copy');
      helper.remove();
      statusOverride = copied ? 'COPIED' : 'COPY FAILED';
    }

    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (statusOverride = ''), 1600);
  }

  function applyLayout() {
    layout = computeStageLayout(window.innerWidth, window.innerHeight);
    controller?.resize(
      window.innerWidth,
      window.innerHeight,
      layout.frameScale.x,
      layout.frameScale.y,
    );
  }

  function handlePointerMove(event: PointerEvent) {
    reticleX = event.clientX;
    reticleY = event.clientY;
    reticleVisible = true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onExit();
  }

  onMount(() => {
    document.body.classList.add('npc-mode');
    const seed = get(conversationDraft);
    if (sourceText.trim()) {
      // Router restored a draft; keep it as-is.
      userEdited = true;
    } else if (seed.text.trim()) {
      // Continue the conversation from the Translate view; treat the handed
      // text as user-authored so switching species/direction won't replace it.
      sourceText = seed.text;
      direction = seed.direction;
      userEdited = true;
    } else {
      sourceText = createSample(selectedRace, direction);
    }
    handoffReady = true;
    translateNow();
    applyLayout();

    controller = createNpcParallax(canvas, {
      onLoading: () => {
        canvasReady = false;
        webglFailed = false;
      },
      onReady: () => {
        webglFailed = false;
        canvasReady = true;
      },
      onFallback: () => {
        canvasReady = false;
        webglFailed = true;
      },
    });

    if (controller) {
      controller.setImages(portrait.color, portrait.depth, portrait.depthRange);
      controller.resize(
        window.innerWidth,
        window.innerHeight,
        layout.frameScale.x,
        layout.frameScale.y,
      );
    }

    window.addEventListener('resize', applyLayout);

    return () => {
      document.body.classList.remove('npc-mode');
      window.removeEventListener('resize', applyLayout);
      if (statusTimer) window.clearTimeout(statusTimer);
      controller?.destroy();
      controller = null;
    };
  });
</script>

<svelte:window onpointermove={handlePointerMove} onkeydown={handleKeydown} />

<section
  class="npc-view"
  class:webgl-failed={webglFailed}
  style={accentStyle}
  aria-label={`Talking to ${portrait.npcName}`}
>
  <div
    class="fallback-plate"
    class:visible={webglFailed}
    style={`background-image: url("${portrait.color}")`}
    aria-hidden="true"
  ></div>
  <canvas bind:this={canvas} class:on={canvasReady} aria-hidden="true"></canvas>
  <div class="vignette" aria-hidden="true"></div>

  <div class="hud">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" opacity=".5" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
    <span>NO MAN'S SKY <b>TRANSLATOR</b></span>
  </div>

  <button class="exit-button" type="button" onclick={onExit} aria-label="Exit NPC dialogue">
    <Icon name="x" size={14} />
    <span>Exit</span>
  </button>

  <div class="npc-ui">
    <div class="input-window" style={inputStyle}>
      <select bind:value={selectedRace} onchange={handleRaceChange} aria-label="Alien race">
        {#each alienData.races as race}
          <option value={race.name}>{race.name.toLocaleUpperCase('en')}</option>
        {/each}
      </select>
      <input
        bind:value={sourceText}
        oninput={handleInput}
        type="text"
        autocomplete="off"
        spellcheck="false"
        aria-label="Text to translate"
        placeholder={inputPlaceholder}
      />
    </div>

    <!-- Outside the panel on purpose: the panel's mask would clip these to its
         border box and slice the overhanging speaker tab in half. -->
    <div class="speaker-tag" style={panelVars}>{speakerTag}</div>
    <div class="status-text" style={statusVars}>{statusText}</div>

    <div class="dialogue-panel" style={panelStyle}>
      <div class="output" aria-live="polite">
        <!-- Unkeyed on purpose. The segments are an append-only stream, so
             positional diffing keeps the existing word spans in place and only
             the newly appended ones mount, which is what limits npc-word-in to
             the new text. Keying on the output string remounted the whole
             block per keystroke and replayed every word. -->
        {#each translation?.segments ?? [] as segment, index}
          <span
            class:known={segment.status === 'translated' || segment.status === 'ambiguous'}
            style={`animation-delay:${index * 70}ms`}
          >{segment.output}</span>
        {/each}
      </div>

      <button
        class="copy-button"
        type="button"
        onclick={copyTranslation}
        disabled={!translation?.output}
        aria-label="Copy translation"
      >
        <svg viewBox="0 0 44 64" width="44" aria-hidden="true">
          <rect x="10" y="2" width="24" height="38" rx="12" fill="rgba(255,255,255,.12)" stroke="#e8f4f2" stroke-width="2.5" />
          <rect x="19" y="8" width="6" height="12" rx="3" fill="#e8f4f2" />
          <path class="chevron" d="M6 46 L22 60 L38 46" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <div class="direction-options" style={optionsStyle} role="radiogroup" aria-label="Translation direction">
      <button
        type="button"
        class:active={direction === 'alien-to-english'}
        role="radio"
        aria-checked={direction === 'alien-to-english'}
        onclick={() => setDirection('alien-to-english')}
      >
        <i></i>Alien to English
      </button>
      <button
        type="button"
        class:active={direction === 'english-to-alien'}
        role="radio"
        aria-checked={direction === 'english-to-alien'}
        onclick={() => setDirection('english-to-alien')}
      >
        <i></i>English to Alien
      </button>
    </div>
  </div>

  <div
    class="reticle"
    class:visible={reticleVisible}
    style={`transform: translate(${reticleX}px, ${reticleY}px)`}
    aria-hidden="true"
  ></div>
</section>

<style>
  .npc-view {
    /* Species accent, overridden per-race by the inline custom property on the
       section. Gek's green is the fallback if that ever fails to resolve. */
    --npc-accent: #86e070;
    --npc-gold: #a3915a;
    --npc-panel: rgba(12, 72, 84, .86);
    --npc-ink: #eaf7f5;
    position: fixed;
    inset: 0;
    z-index: 500;
    overflow: hidden;
    color: var(--npc-ink);
    /* Dark on-theme base: the raw frame is never shown full-bleed, so entering
       the mode fades the processed canvas in cleanly with no framing "zoom". */
    background:
      radial-gradient(120% 90% at 50% 100%, #241033 0%, transparent 60%),
      radial-gradient(90% 70% at 50% 0%, #0d1a2e 0%, transparent 55%),
      #150a1f;
    font-family: 'Roboto', 'Roboto Fallback', sans-serif;
    user-select: none;
  }

  .fallback-plate {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-position: center;
    background-size: cover;
    opacity: 0;
    transition: opacity .6s;
  }

  .fallback-plate.visible {
    opacity: 1;
  }

  .npc-view canvas {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity .9s;
  }

  .npc-view canvas.on {
    opacity: 1;
  }

  .vignette {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(5, 0, 12, .65));
  }

  .hud {
    position: absolute;
    z-index: 4;
    left: 3vw;
    top: 3vh;
    display: flex;
    gap: 14px;
    align-items: center;
    color: #cfeee9;
    font-size: 14px;
    font-weight: 300;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .hud svg {
    width: 26px;
    height: 26px;
    /* currentColor, because var() is not honoured in SVG presentation
       attributes. */
    color: var(--npc-accent);
  }

  .hud b {
    color: var(--npc-accent);
    font-weight: 500;
  }

  .exit-button {
    position: absolute;
    z-index: 6;
    right: 3vw;
    top: 3vh;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 13px;
    border: 1px solid rgba(163, 145, 90, .55);
    color: #cfe9e6;
    background: rgba(10, 52, 62, .62);
    font: inherit;
    font-size: 11px;
    letter-spacing: .16em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background .15s, color .15s, transform .15s;
  }

  .exit-button:hover {
    color: #fff;
    background: rgba(40, 120, 110, .85);
    transform: translateX(-4px);
  }

  .npc-ui {
    position: absolute;
    inset: 0;
    z-index: 3;
  }

  .input-window {
    position: absolute;
    z-index: 5;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 16px;
    border: 1px solid var(--npc-gold);
    border-left: 3px solid var(--npc-accent);
    background: rgba(8, 44, 54, .72);
  }

  .input-window select {
    padding: 4px 0;
    border: 0;
    outline: 0;
    color: var(--npc-accent);
    background: transparent;
    font: inherit;
    font-size: 13px;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .input-window select option {
    color: var(--npc-ink);
    background: #0c4854;
  }

  .input-window input {
    flex: 1;
    min-width: 0;
    padding: 8px 0;
    border: 0;
    outline: 0;
    color: var(--npc-ink);
    background: none;
    font: 400 clamp(16px, 1.3vw, 22px) 'Roboto', 'Roboto Fallback', sans-serif;
  }

  .input-window input::placeholder {
    color: #79a9a8;
  }

  .dialogue-panel {
    position: absolute;
    z-index: 4;
    display: flex;
    align-items: center;
    padding: 0 90px 0 72px;
    border-top: 1px solid var(--npc-gold);
    border-bottom: 1px solid var(--npc-gold);
    background: linear-gradient(90deg, var(--npc-panel), rgba(12, 72, 84, .6) 85%, rgba(12, 72, 84, .1));
    -webkit-mask: linear-gradient(90deg, #000 88%, transparent);
    mask: linear-gradient(90deg, #000 88%, transparent);
  }

  .dialogue-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(rgba(140, 255, 235, .13) 1px, transparent 1.3px) 0 0 / 14px 14px;
  }

  /* Siblings of .dialogue-panel, positioned from the panel geometry. The
     --dx/--dy indirection keeps the narrow-screen overrides working without
     inline styles having to win over the media query. */
  .speaker-tag {
    --tag-dx: 44px;
    --tag-dy: -22px;
    position: absolute;
    left: calc(var(--panel-left) + var(--tag-dx));
    top: calc(var(--panel-top) + var(--tag-dy));
    z-index: 5;
    padding: 5px 28px;
    border: 1px solid rgba(163, 145, 90, .5);
    border-bottom: 0;
    border-radius: 999px 999px 0 0;
    color: var(--npc-accent);
    background: rgba(9, 46, 56, .95);
    font-size: clamp(15px, 1.15vw, 21px);
  }

  .status-text {
    --status-dx: 46px;
    --status-dy: 12px;
    position: absolute;
    /* Anchored from the right edge of .npc-ui, offset back to the panel's own
       right edge. Using `right` (rather than left + translateX) keeps the
       shrink-to-fit width honest, so the readout never wraps to three lines. */
    right: calc(100% - var(--panel-left) - var(--panel-width) + var(--status-dx));
    top: calc(var(--panel-top) + var(--status-dy));
    z-index: 5;
    color: #8fcfc7;
    font-size: 13px;
    letter-spacing: .1em;
    white-space: nowrap;
  }

  .output {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
    min-height: 1.35em;
    font-size: clamp(20px, 2vw, 34px);
    font-weight: 400;
    line-height: 1.35;
  }

  .output span {
    display: inline-block;
    white-space: pre;
    animation: npc-word-in .5s both;
  }

  .output span.known {
    color: var(--npc-accent);
  }

  .copy-button {
    position: absolute;
    left: 50%;
    bottom: -62px;
    z-index: 3;
    width: 44px;
    padding: 0;
    border: 0;
    background: none;
    transform: translateX(-50%);
    cursor: pointer;
  }

  .copy-button:disabled {
    opacity: .35;
    cursor: default;
  }

  .copy-button .chevron {
    animation: npc-bounce 1.4s ease-in-out infinite;
  }

  .direction-options {
    position: absolute;
    right: 5vw;
    z-index: 6;
    display: grid;
    gap: 8px;
    width: min(24vw, 380px);
  }

  .direction-options button {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 18px;
    border: 1px solid rgba(163, 145, 90, .55);
    color: #cfe9e6;
    background: rgba(10, 52, 62, .78);
    font: 400 clamp(14px, 1.1vw, 19px) 'Roboto', 'Roboto Fallback', sans-serif;
    text-align: left;
    cursor: pointer;
    transition: background .15s, color .15s, transform .15s;
  }

  .direction-options button i {
    width: 14px;
    height: 14px;
    flex: none;
    border: 2px solid currentColor;
    transform: rotate(45deg);
  }

  .direction-options button:hover {
    color: #fff;
    background: rgba(40, 120, 110, .85);
  }

  .direction-options button.active {
    color: #fff;
    /* Species accent at the same alpha the fixed green used to have. Note the
       white label drops below WCAG AA on the paler species (Gek 1.96,
       Autophage 1.87, Korvax 2.06, Vy'keen 4.06; only Atlas reaches 4.52).
       Accepted deliberately to keep the button on-palette. */
    background: color-mix(in srgb, var(--npc-accent) 88%, transparent);
    transform: translateX(-8px);
  }

  .direction-options button.active i {
    border-color: var(--npc-accent);
    background: var(--npc-accent);
  }

  .reticle {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 9;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border: 2px solid rgba(255, 255, 255, .85);
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(0, 0, 0, .5);
    pointer-events: none;
    opacity: 0;
    transition: opacity .12s ease;
  }

  .reticle::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4px;
    height: 4px;
    margin: -2px;
    border-radius: 50%;
    background: #fff;
  }

  .reticle.visible {
    opacity: 1;
  }

  .npc-view :global(button:focus-visible),
  .npc-view :global(input:focus-visible),
  .npc-view :global(select:focus-visible) {
    outline: 2px solid var(--npc-accent);
    outline-offset: 2px;
  }

  @keyframes npc-word-in {
    from {
      opacity: 0;
      filter: blur(5px);
      transform: translateY(4px);
    }
  }

  @keyframes npc-bounce {
    50% { transform: translateY(5px); }
  }

  @media (pointer: fine) {
    .npc-view,
    .npc-view * {
      cursor: none !important;
    }
  }

  @media (max-width: 820px) {
    .reticle,
    .copy-button {
      display: none;
    }

    .hud {
      font-size: 11px;
    }

    .hud svg {
      width: 21px;
      height: 21px;
    }

    .exit-button {
      padding: 0 10px;
    }

    .exit-button span {
      display: none;
    }

    .input-window {
      padding: 5px 10px;
    }

    .input-window select {
      max-width: 92px;
      font-size: 11px;
    }

    .dialogue-panel {
      padding: 0 34px 0 30px;
    }

    .speaker-tag {
      --tag-dx: 22px;
      padding: 4px 16px;
    }

    .status-text {
      --status-dx: 24px;
      --status-dy: 9px;
      font-size: 10px;
    }

    .output {
      font-size: clamp(17px, 4.4vw, 24px);
    }

    .direction-options {
      top: 56px !important;
      right: 3vw;
      bottom: auto !important;
      left: 3vw;
      width: auto;
      grid-template-columns: 1fr 1fr;
    }

    .direction-options button {
      padding: 10px 12px;
      font-size: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .output span,
    .copy-button .chevron {
      animation: none;
    }

    .npc-view canvas {
      transition: none;
    }
  }
</style>
