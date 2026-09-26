<script lang="ts">
  import { onDestroy } from 'svelte';
  import { alienData, translationEngine } from '../data';
  import { RACE_META } from '../races';
  import type { AlienEntry, Category, RaceName } from '../types';
  import Icon from './Icon.svelte';
  import RaceGlyph from './RaceGlyph.svelte';

  export let selectedRace: RaceName = 'Gek';

  let query = '';
  let category: Category | 'ALL' = 'ALL';
  let limit = 120;
  let copiedKey = '';

  const categories: Array<Category | 'ALL'> = ['ALL', 'MISC', 'HELP', 'TRADE', 'LORE', 'DIRECTIONS', 'THREAT', 'TECH'];
  let copyTimer: number | undefined;

  $: raceEntries = translationEngine.getEntries(selectedRace);
  $: normalizedQuery = query.trim().toLocaleLowerCase('en');
  $: filteredEntries = [...raceEntries]
    .filter((entry) => {
      if (category !== 'ALL' && entry.category !== category) return false;
      if (!normalizedQuery) return true;
      return [entry.english, entry.surface, entry.key]
        .some((value) => value.toLocaleLowerCase('en').includes(normalizedQuery));
    })
    .sort((a, b) => b.frequency - a.frequency || a.english.localeCompare(b.english));
  $: visibleEntries = filteredEntries.slice(0, limit);
  $: hasMore = filteredEntries.length > visibleEntries.length;

  onDestroy(() => {
    if (copyTimer) window.clearTimeout(copyTimer);
  });

  function handleSearch() {
    limit = 120;
  }

  async function copyValue(entry: AlienEntry, value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    copiedKey = key;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (copiedKey = ''), 1400);
  }
</script>

<section class="phrasebook-view view-enter" aria-labelledby="phrasebook-title">
  <header class="page-header">
    <div>
      <span class="eyebrow">02 / Lexical catalogue</span>
      <h1 id="phrasebook-title">Alien Phrasebook</h1>
      <p>Search every indexed English term and generated alien word.</p>
    </div>
    <div class="archive-total" style={`--race-accent: ${RACE_META[selectedRace].accent}`}>
      <RaceGlyph race={selectedRace} size={54} />
      <span>
        <small>Current archive</small>
        <strong>{selectedRace}</strong>
        <em>{raceEntries.length.toLocaleString('en')} records</em>
      </span>
    </div>
  </header>

  <div class="phrasebook-frame">
    <aside class="species-filter">
      <span class="section-title">Species archive</span>
      {#each alienData.races as race}
        <button
          type="button"
          class:active={selectedRace === race.name}
          style={`--race-accent: ${RACE_META[race.name].accent}`}
          onclick={() => {
            selectedRace = race.name;
            limit = 120;
          }}
        >
          <RaceGlyph race={race.name} size={36} />
          <span>
            <strong>{race.name}</strong>
            <small>{translationEngine.getRaceCount(race.name)} entries</small>
          </span>
          <i></i>
        </button>
      {/each}
    </aside>

    <div class="catalogue-content">
      <div class="catalogue-tools">
        <label class="search-box">
          <Icon name="search" size={19} />
          <input
            type="search"
            bind:value={query}
            oninput={handleSearch}
            placeholder="Search English, alien text, or localization key..."
            autocomplete="off"
          />
          {#if query}
            <button type="button" onclick={() => (query = '')} aria-label="Clear search">
              <Icon name="x" size={15} />
            </button>
          {:else}
            <kbd>/</kbd>
          {/if}
        </label>

        <label class="category-select">
          <Icon name="filter" size={17} />
          <span>Category</span>
          <select bind:value={category} onchange={handleSearch}>
            {#each categories as item}
              <option value={item}>{item === 'ALL' ? 'All signals' : item}</option>
            {/each}
          </select>
          <Icon name="chevron" size={15} />
        </label>
      </div>

      <div class="results-heading">
        <span>
          <strong>{filteredEntries.length.toLocaleString('en')}</strong>
          matching records
        </span>
        <span>Sorted by lexical frequency</span>
      </div>

      <div class="catalogue-table-wrap">
        <table>
          <thead>
            <tr>
              <th>English signal</th>
              <th>Alien word</th>
              <th>Category</th>
              <th>Freq.</th>
              <th><span class="sr-only">Copy</span></th>
            </tr>
          </thead>
          <tbody>
            {#each visibleEntries as entry (entry.sourceIndex)}
              <tr>
                <td>
                  <button
                    class="copyable english-value"
                    type="button"
                    onclick={() => copyValue(entry, entry.english, `${entry.sourceIndex}-english`)}
                    title="Copy English"
                  >
                    <span>{entry.english}</span>
                    {#if copiedKey === `${entry.sourceIndex}-english`}<Icon name="check" size={14} />{/if}
                  </button>
                  <small>{entry.key}</small>
                </td>
                <td>
                  <button
                    class="copyable alien-value"
                    type="button"
                    onclick={() => copyValue(entry, entry.surface, `${entry.sourceIndex}-alien`)}
                    title="Copy alien word"
                  >
                    <span>{entry.surface}</span>
                    {#if copiedKey === `${entry.sourceIndex}-alien`}<Icon name="check" size={14} />{/if}
                  </button>
                </td>
                <td><span class:threat={entry.category === 'THREAT'} class="category-chip">{entry.category}</span></td>
                <td><span class:zero={entry.frequency === 0} class="frequency">{entry.frequency}</span></td>
                <td>
                  <button
                    class="row-copy"
                    type="button"
                    onclick={() => copyValue(entry, entry.surface, `${entry.sourceIndex}-alien`)}
                    aria-label={`Copy alien translation for ${entry.english}`}
                  >
                    <Icon name="copy" size={15} />
                  </button>
                </td>
              </tr>
            {:else}
              <tr class="empty-row">
                <td colspan="5">
                  <span class="empty-icon"><Icon name="search" size={28} /></span>
                  <strong>No matching signals</strong>
                  <small>Try a different word, spelling, or category.</small>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <footer class="catalogue-footer">
        <span>Showing {visibleEntries.length.toLocaleString('en')} of {filteredEntries.length.toLocaleString('en')}</span>
        {#if hasMore}
          <button type="button" onclick={() => (limit += 120)}>
            Load more signals
            <Icon name="chevron" size={15} />
          </button>
        {:else}
          <span class="end-marker"><i></i> End of archive segment</span>
        {/if}
      </footer>
    </div>
  </div>
</section>

<style>
  .phrasebook-view {
    width: min(1600px, 100%);
    min-height: calc(100svh - 114px);
    margin: 0 auto;
    padding: 42px clamp(28px, 4vw, 64px) 30px;
  }

  h1,
  p {
    margin: 0;
  }

  .eyebrow,
  .section-title {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    font-weight: 600;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    margin-bottom: 28px;
  }

  .page-header h1 {
    margin-top: 8px;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: clamp(1.8rem, 3vw, 2.7rem);
    font-weight: 300;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .page-header p {
    margin-top: 6px;
    color: var(--text-muted);
    font-size: .83rem;
    letter-spacing: .04em;
  }

  .archive-total {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 250px;
    padding: 10px 18px 10px 12px;
    border: 1px solid color-mix(in srgb, var(--race-accent) 25%, transparent);
    color: var(--race-accent);
    background: rgba(5, 13, 28, .5);
    clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
  }

  .archive-total > span {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    flex: 1;
  }

  .archive-total small,
  .archive-total em {
    grid-column: 1 / -1;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .52rem;
    font-style: normal;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .archive-total strong {
    margin-top: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .archive-total em {
    margin-top: 4px;
    text-align: right;
  }

  .phrasebook-frame {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    min-height: 590px;
    border: 1px solid rgba(112, 193, 209, .2);
    background: rgba(3, 9, 20, .56);
    box-shadow: 0 24px 60px rgba(0, 0, 0, .18);
  }

  .species-filter {
    padding: 24px 14px;
    border-right: 1px solid rgba(112, 193, 209, .18);
    background: linear-gradient(90deg, rgba(21, 8, 20, .35), transparent);
  }

  .section-title {
    display: block;
    margin: 0 8px 13px;
  }

  .species-filter button {
    position: relative;
    display: grid;
    grid-template-columns: 43px 1fr auto;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 61px;
    padding: 6px 12px;
    border: 0;
    color: var(--text-muted);
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: 150ms ease;
  }

  .species-filter button::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: linear-gradient(90deg, rgba(150, 25, 61, .68), rgba(80, 20, 44, .2));
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .species-filter button:hover::before,
  .species-filter button.active::before {
    opacity: 1;
  }

  .species-filter button.active {
    color: #fff;
  }

  .species-filter button.active::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--signal-yellow);
  }

  .species-filter :global(svg),
  .species-filter button > span,
  .species-filter button > i {
    position: relative;
    z-index: 1;
  }

  .species-filter :global(svg) {
    color: var(--race-accent);
  }

  .species-filter button > span {
    display: flex;
    flex-direction: column;
  }

  .species-filter strong {
    font-size: .82rem;
    font-weight: 400;
    letter-spacing: .04em;
  }

  .species-filter small {
    margin-top: 4px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .5rem;
    letter-spacing: .09em;
  }

  .species-filter button > i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--race-accent);
    box-shadow: 0 0 6px var(--race-accent);
    opacity: .25;
  }

  .species-filter button.active > i {
    opacity: 1;
  }

  .catalogue-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .catalogue-tools {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) auto;
    gap: 10px;
    padding: 17px;
    border-bottom: 1px solid rgba(112, 193, 209, .17);
  }

  .search-box,
  .category-select {
    display: flex;
    align-items: center;
    min-height: 43px;
    border: 1px solid rgba(112, 193, 209, .18);
    color: var(--signal-cyan);
    background: rgba(4, 11, 24, .66);
  }

  .search-box {
    padding: 0 12px;
  }

  .search-box input {
    min-width: 0;
    flex: 1;
    height: 41px;
    padding: 0 12px;
    border: 0;
    outline: 0;
    color: var(--text-primary);
    background: transparent;
    font: inherit;
    font-size: .8rem;
  }

  .search-box input::placeholder {
    color: rgba(159, 180, 194, .4);
  }

  .search-box button {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    padding: 0;
    border: 0;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  kbd {
    padding: 3px 7px;
    border: 1px solid rgba(112, 193, 209, .2);
    color: var(--text-dim);
    background: rgba(255, 255, 255, .025);
    font-family: var(--font-body);
    font-size: .58rem;
  }

  .category-select {
    position: relative;
    min-width: 200px;
    padding-left: 12px;
  }

  .category-select > span {
    margin-left: 9px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .55rem;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .category-select select {
    flex: 1;
    height: 41px;
    padding: 0 30px 0 8px;
    border: 0;
    outline: 0;
    appearance: none;
    color: var(--text-primary);
    background: transparent;
    font: inherit;
    font-size: .7rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .category-select select option {
    color: #eaf2f5;
    background: #091326;
  }

  .category-select > :global(svg:last-child) {
    position: absolute;
    right: 10px;
    pointer-events: none;
  }

  .results-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 39px;
    padding: 0 18px;
    border-bottom: 1px solid rgba(112, 193, 209, .11);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .56rem;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .results-heading strong {
    color: var(--signal-yellow);
    font-size: .7rem;
  }

  .catalogue-table-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
    scrollbar-color: rgba(83, 194, 210, .35) transparent;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th,
  td {
    border-bottom: 1px solid rgba(112, 193, 209, .08);
    text-align: left;
  }

  th {
    position: sticky;
    z-index: 2;
    top: 0;
    height: 37px;
    padding: 0 12px;
    color: var(--text-dim);
    background: rgba(5, 12, 25, .97);
    font-family: var(--font-body);
    font-size: .52rem;
    font-weight: 500;
    letter-spacing: .13em;
    text-transform: uppercase;
  }

  th:nth-child(1) { width: 34%; }
  th:nth-child(2) { width: 34%; }
  th:nth-child(3) { width: 16%; }
  th:nth-child(4) { width: 8%; }
  th:nth-child(5) { width: 44px; }

  td {
    height: 54px;
    padding: 7px 12px;
    color: var(--text-muted);
    font-size: .73rem;
  }

  tbody tr {
    transition: background 120ms ease;
  }

  tbody tr:hover {
    background: rgba(70, 181, 199, .045);
  }

  td:first-child small {
    display: block;
    max-width: 100%;
    margin-top: 2px;
    overflow: hidden;
    color: rgba(130, 152, 167, .45);
    font-family: var(--font-body);
    font-size: .47rem;
    letter-spacing: .05em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copyable {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  .copyable span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copyable:hover {
    color: #fff;
  }

  .english-value {
    color: var(--text-primary);
    font-size: .8rem;
  }

  .alien-value {
    color: var(--signal-cyan);
    font-family: var(--font-heading);
    font-size: .86rem;
  }

  .category-chip {
    display: inline-flex;
    align-items: center;
    min-height: 21px;
    padding: 0 7px;
    border: 1px solid rgba(93, 212, 228, .2);
    color: #7fdbe8;
    background: rgba(35, 153, 170, .08);
    font-family: var(--font-body);
    font-size: .49rem;
    letter-spacing: .1em;
  }

  .category-chip.threat {
    color: #ff9a87;
    border-color: rgba(255, 113, 91, .28);
    background: rgba(202, 51, 35, .1);
  }

  .frequency {
    color: var(--signal-yellow);
    font-family: var(--font-body);
    font-weight: 600;
  }

  .frequency.zero {
    color: var(--text-dim);
  }

  .row-copy {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    padding: 0;
    border: 1px solid rgba(112, 193, 209, .15);
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  .row-copy:hover {
    color: var(--signal-yellow);
    border-color: rgba(255, 216, 75, .35);
  }

  .empty-row td {
    height: 330px;
    text-align: center;
  }

  .empty-row td > * {
    display: block;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 65px;
    height: 65px;
    margin: 0 auto 16px;
    border: 1px solid rgba(112, 193, 209, .2);
    color: var(--signal-cyan);
    transform: rotate(45deg);
  }

  .empty-icon :global(svg) {
    transform: rotate(-45deg);
  }

  .empty-row strong {
    color: var(--text-muted);
    font-size: .78rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .empty-row small {
    margin-top: 7px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .65rem;
  }

  .catalogue-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 18px;
    border-top: 1px solid rgba(112, 193, 209, .15);
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .58rem;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .catalogue-footer button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid rgba(112, 193, 209, .24);
    color: var(--text-muted);
    background: rgba(8, 19, 35, .6);
    font: inherit;
    font-size: .56rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .catalogue-footer button :global(svg) {
    transform: rotate(180deg);
  }

  .end-marker {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .end-marker i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--signal-cyan);
    box-shadow: 0 0 7px var(--signal-cyan);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 1050px) {
    .phrasebook-frame {
      grid-template-columns: 1fr;
    }

    .species-filter {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      padding: 10px;
      border-right: 0;
      border-bottom: 1px solid rgba(112, 193, 209, .18);
    }

    .species-filter .section-title {
      display: none;
    }

    .species-filter button {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 68px;
      padding: 5px;
      text-align: center;
    }

    .species-filter button > i,
    .species-filter small {
      display: none;
    }

    .species-filter strong {
      font-size: .65rem;
    }
  }

  @media (max-width: 760px) {
    .phrasebook-view {
      padding: 28px 14px 20px;
    }

    .page-header p,
    .archive-total > span {
      display: none;
    }

    .archive-total {
      min-width: 0;
      padding: 6px 10px;
    }

    .catalogue-tools {
      grid-template-columns: 1fr;
    }

    .category-select {
      min-width: 0;
    }

    .catalogue-table-wrap {
      overflow-x: auto;
    }

    table {
      min-width: 560px;
    }

    .results-heading > span:last-child {
      display: none;
    }
  }
</style>
