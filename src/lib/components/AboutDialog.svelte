<script lang="ts">
  /**
   * The About dialog: what this project is made of, and who owns what.
   *
   * Every licence text is a link to the copy shipped in public/, not to an
   * upstream page and not to text inlined in the bundle. The site is a static
   * offline-first app, so a notice that needs a network round trip is a notice
   * a visitor standing on a train cannot act on.
   *
   * Closing follows the same three affordances NpcView offers: Escape, the
   * backdrop, and an explicit control. Focus moves in on open and goes back to
   * the button that opened it on close, so keyboard users do not land back at
   * the top of the document.
   *
   * Deliberately short. The archive version and the last sync date used to sit
   * in the header, but TopBar's status strip already shows both directly above
   * this dialog, so the copy only made the panel taller.
   */
  import { onMount } from 'svelte';
  import { GAME_ASSETS_NOTICE, LICENSES, licenseHref } from '../licenses';
  import Icon from './Icon.svelte';

  export let onClose: () => void = () => undefined;

  /** Returned by the opener so focus can go back where it came from. */
  let panel: HTMLDivElement;
  let closeButton: HTMLButtonElement;
  let opener: HTMLElement | null = null;

  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('about-open');
    closeButton?.focus();

    return () => {
      document.body.classList.remove('about-open');
      opener?.focus();
    };
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Stops the Escape from bubbling to the window listeners on the views
      // underneath, which would otherwise also fire their own Escape action.
      event.stopPropagation();
      onClose();
      return;
    }

    // Minimal focus trap. Tabbing past the last control would otherwise put
    // focus behind the overlay, where the browser scrolls to a section of the
    // page the dialog has just covered.
    if (event.key !== 'Tab') return;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<!--
  keydown is bound here rather than to the window on purpose. Escape is already
  a global shortcut on the views behind this dialog - TranslateView clears the
  source box on Escape, NpcView exits the dialogue - so a window listener would
  let one keypress close the dialog *and* clear whatever the visitor had typed.
  Handling it on the dialog root keeps the shortcut local, and stopPropagation
  keeps it from reaching the handlers behind. Focus is trapped inside the panel
  below, so the event cannot originate anywhere else.
-->
<!--
  Behind the dialog and below it in z-order, so it only ever closes the dialog
  it belongs to. aria-hidden because the dialog itself is the accessible object
  and a focusable sibling would break the aria-modal contract.
-->
<div class="about-backdrop" onclick={onClose} aria-hidden="true"></div>

<div
  class="about-dialog"
  role="dialog"
  aria-modal="true"
  aria-labelledby="about-title"
  tabindex="-1"
  bind:this={panel}
  onkeydown={handleKeydown}
>
  <header class="about-header">
    <div class="about-heading">
      <span class="eyebrow">00 / Colophon</span>
      <h1 id="about-title">About this translator</h1>
    </div>
    <!--
      The source link lives in the header rather than in a footer row: it is the
      one outbound action in this dialog, and putting it next to the close
      control keeps the whole panel two sections tall. A footer row cost a whole
      extra line for a link that is never the reason anyone reads the licences.
    -->
    <div class="about-header-actions">
      <a
        class="about-source"
        href="https://github.com/edgetype/nms-translator"
        target="_blank"
        rel="noopener noreferrer"
        title="Open the source on GitHub"
      >
        <Icon name="github" size={14} strokeWidth={1.6} />
        <span>Source</span>
      </a>
      <button
        class="about-close"
        type="button"
        onclick={onClose}
        bind:this={closeButton}
        aria-label="Close"
        title="Close (Esc)"
      >
        <Icon name="x" size={17} />
      </button>
    </div>
  </header>

  <div class="about-body">
    <!--
      The game data paragraph comes first on purpose. It is the only entry on
      this page that is not ours to grant, so it should not be the last thing a
      reader scrolls past.

      The "unofficial fan project" wording is deliberately not repeated here:
      the site footer says it in full, twenty pixels below this dialog.
    -->
    <section class="about-section notice" aria-labelledby="about-assets-title">
      <div class="about-section-head">
        <h2 id="about-assets-title">{GAME_ASSETS_NOTICE.title}</h2>
        <span class="panel-index">A</span>
      </div>
      <p>{GAME_ASSETS_NOTICE.body}</p>
    </section>

    <!--
      One list, not two. Svelte and tesseract.js are both "built with" and both
      licensed components, and splitting them across two sections said the same
      names twice. Vite and Vitest are gone for the same reason: they are
      devDependencies and neither reaches the shipped bundle, so there is
      nothing in the page for a visitor to be grateful for.

      Each row therefore has two outbound targets, and they are not
      interchangeable. The name goes to the upstream project, because that is
      what a reader who wants to know what something is actually looking for.
      The LICENCE button goes to the copy shipped in public/, because that is
      the one that satisfies the obligation: MIT and Apache-2.0 both require the
      notice to travel inside the distribution, and Svelte's compiled output and
      tesseract.js are both inside this bundle. A link to a licence on someone
      else's server does not travel with the code, so it cannot stand in.
    -->
    <section class="about-section" aria-labelledby="about-licenses-title">
      <div class="about-section-head">
        <h2 id="about-licenses-title">Licences</h2>
        <span class="panel-index">B</span>
      </div>

      <ul class="license-list">
        {#each LICENSES as notice}
          <li>
            <div class="license-copy">
              <a
                class="license-name"
                href={notice.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${notice.name} — project homepage`}
              >{notice.name}</a>
              <small class="license-meta">
                {notice.license} · {notice.holder} · {notice.role}
              </small>
              <!-- OFL section 3: a modified font may only be redistributed if
                   the modification is stated. Kept on screen rather than buried
                   in a repo file, because it is a condition of the licence. -->
              {#if notice.changes}
                <small class="license-change">
                  <Icon name="refresh" size={12} />
                  Modified: {notice.changes}
                </small>
              {/if}
              {#if notice.note}
                <small class="license-note">{notice.note}</small>
              {/if}
            </div>
            <a
              class="license-link"
              href={licenseHref(notice)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open the ${notice.license} text`}
            >
              <span>Licence</span>
              <Icon name="external" size={14} />
            </a>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</div>

<style>
  .about-backdrop {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(2, 5, 12, .78);
    backdrop-filter: blur(6px);
    animation: about-fade 180ms ease both;
  }

  .about-dialog {
    position: fixed;
    z-index: 401;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    width: min(760px, calc(100vw - 32px));
    max-height: min(86svh, 46rem);
    border: 1px solid rgba(112, 193, 209, .22);
    color: var(--text-muted);
    background: rgba(4, 10, 23, .96);
    box-shadow: 0 24px 70px rgba(0, 0, 0, .55);
    font-family: var(--font-body);
    animation: about-rise 200ms cubic-bezier(.2, .7, .2, 1) both;
  }

  /* The heading font is the only place Rajdhani appears above body size, which
     is what gives the dialog the same voice as the page it was opened from. */
  .about-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(112, 193, 209, .17);
  }

  .eyebrow {
    color: var(--text-dim);
    font-size: .64rem;
    font-weight: 600;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  .about-header h1 {
    margin: 5px 0 0;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 300;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .about-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }

  /* Deliberately quieter than the licence links, which are the reason the
     dialog exists. Marked as the repo it is, not the full URL: the long address
     is already in the page footer directly below. */
  .about-source {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid rgba(112, 193, 209, .2);
    color: var(--text-dim);
    font-size: .64rem;
    font-weight: 600;
    letter-spacing: .14em;
    text-decoration: none;
    text-transform: uppercase;
    white-space: nowrap;
    transition: 150ms ease;
  }

  /* Icon.svelte owns the .icon class on its own <svg>, so a component-scoped
     selector cannot reach across into it. Needs :global for the same reason
     the footer styles these from app.css instead. */
  :global(.about-source .icon) {
    opacity: .75;
    transition: opacity 150ms ease;
  }

  .about-source:hover,
  .about-source:focus-visible {
    color: var(--signal-cyan);
    border-color: rgba(112, 193, 209, .5);
  }

  :global(.about-source:hover .icon),
  :global(.about-source:focus-visible .icon) {
    opacity: 1;
  }

  .about-close {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid rgba(112, 193, 209, .24);
    color: var(--text-muted);
    background: rgba(8, 18, 34, .6);
    cursor: pointer;
    transition: 150ms ease;
  }

  .about-close:hover {
    color: #071018;
    border-color: var(--signal-yellow);
    background: var(--signal-yellow);
  }

  .about-body {
    min-height: 0;
    padding: 0 24px 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .about-section {
    padding: 16px 0;
    border-bottom: 1px solid rgba(112, 193, 209, .1);
  }

  /* Last section has no divider, which would otherwise read as a cut-off row
     above the dialog's bottom padding. */
  .about-section:last-child {
    padding-bottom: 4px;
    border-bottom: 0;
  }

  .about-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .about-section h2 {
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: .95rem;
    font-weight: 400;
    letter-spacing: .13em;
    text-transform: uppercase;
  }

  .panel-index {
    color: var(--signal-yellow);
    font-size: .74rem;
    font-weight: 600;
    letter-spacing: .14em;
  }

  /* The Hello Games paragraph is the reason the dialog exists, so it gets the
     only highlighted treatment on the page. */
  .about-section.notice {
    margin: 0 -24px;
    padding: 14px 24px;
    border-left: 2px solid var(--signal-yellow);
    background: rgba(255, 216, 63, .045);
  }

  .about-section p {
    margin: 0 0 8px;
    font-size: .78rem;
    line-height: 1.65;
  }

  .about-section p:last-child {
    margin-bottom: 0;
  }

  .license-list {
    display: grid;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
    background: rgba(112, 193, 209, .1);
  }

  .license-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 14px;
    background: rgba(6, 13, 27, .92);
  }

  .license-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  /* Was a <strong>; now the row's upstream link. Resting appearance is kept
     identical to the old bold text so making it clickable shifts nothing, and
     the affordance is hover-only - an underline on all four rows would turn the
     list into a wall of links and compete with the LICENCE button, which is
     the control this dialog actually needs pressed. */
  .license-name {
    align-self: flex-start;
    color: var(--text-primary);
    font-size: .82rem;
    font-weight: 600;
    letter-spacing: .05em;
    text-decoration: none;
    transition: color 150ms ease;
  }

  .license-name:hover,
  .license-name:focus-visible {
    color: var(--signal-cyan);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .license-meta {
    color: var(--text-muted);
    font-size: .68rem;
    letter-spacing: .06em;
  }

  /* OFL section 3: a modification has to be stated. Labelled as its own line
     so it cannot be mistaken for part of the licence name. */
  .license-change {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--signal-cyan);
    font-size: .68rem;
    letter-spacing: .04em;
  }

  .license-note {
    color: var(--text-dim);
    font-size: .66rem;
    letter-spacing: .04em;
  }

  .license-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    min-height: 28px;
    padding: 0 11px;
    border: 1px solid rgba(112, 193, 209, .26);
    color: var(--signal-cyan);
    font-size: .66rem;
    font-weight: 600;
    letter-spacing: .14em;
    text-decoration: none;
    text-transform: uppercase;
    white-space: nowrap;
    transition: 150ms ease;
  }

  .license-link:hover,
  .license-link:focus-visible {
    color: #071018;
    border-color: var(--signal-yellow);
    background: var(--signal-yellow);
  }

  /* Opacity only, matching .view-enter in app.css: a transform here would
     replay visible movement against the noise overlay on open. */
  @keyframes about-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* The dialog itself does move, unlike the page behind it - it is a layer
     arriving over content the user was already reading. */
  @keyframes about-rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 12px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  @media (max-width: 620px) {
    .about-header {
      padding: 16px;
    }

    /* Icon only: the heading is uppercase and letter-spaced, so at 320px the
       label was the thing that pushed the row past the dialog's width. The
       title attribute and the github glyph both still identify the target. */
    .about-source span {
      display: none;
    }

    .about-source {
      padding: 0 9px;
    }

    .about-body {
      padding: 0 16px 16px;
    }

    .about-section.notice {
      margin: 0 -16px;
      padding: 16px;
    }

    /* Stacked: the licence name, its metadata and the control each get a full
       row rather than a squeezed two-column split. */
    .license-list li {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .license-link {
      width: 100%;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .about-backdrop,
    .about-dialog {
      animation: none;
    }
  }
</style>
