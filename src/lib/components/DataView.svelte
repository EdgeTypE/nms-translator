<script lang="ts">
  import { alienData, translationEngine } from '../data';
  import { RACE_META } from '../races';
  import Icon from './Icon.svelte';
  import RaceGlyph from './RaceGlyph.svelte';

  const categoryCounts = Object.entries(alienData.entries.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.category] = (totals[entry.category] ?? 0) + 1;
    return totals;
  }, {})).sort((a, b) => b[1] - a[1]);

  const maxCategoryCount = categoryCounts[0]?.[1] ?? 1;
  const archiveSize = (JSON.stringify(alienData).length / 1_048_576).toFixed(2);
  const generatedDate = new Date(alienData.generatedUtc).toLocaleString('en', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
</script>

<section class="data-view view-enter" aria-labelledby="data-title">
  <header class="page-header">
    <div>
      <span class="eyebrow">03 / System provenance</span>
      <h1 id="data-title">Archive Data</h1>
      <p>Source verification, language distribution, and local processing details.</p>
    </div>
    <div class="offline-badge">
      <Icon name="lock" size={20} />
      <span>
        <small>Network calls</small>
        <strong>Zero</strong>
      </span>
    </div>
  </header>

  <div class="metric-grid">
    <article>
      <span class="metric-icon"><Icon name="terminal" size={23} /></span>
      <span class="metric-copy">
        <small>Indexed translations</small>
        <strong>{alienData.counts.includedEntries.toLocaleString('en')}</strong>
        <em>1 omitted speech entry</em>
      </span>
      <i>01</i>
    </article>
    <article>
      <span class="metric-icon"><Icon name="compass" size={23} /></span>
      <span class="metric-copy">
        <small>Language profiles</small>
        <strong>{alienData.races.length}</strong>
        <em>Alien species</em>
      </span>
      <i>02</i>
    </article>
    <article>
      <span class="metric-icon"><Icon name="database" size={23} /></span>
      <span class="metric-copy">
        <small>Local archive size</small>
        <strong>{archiveSize} <b>MB</b></strong>
        <em>JSON source data</em>
      </span>
      <i>03</i>
    </article>
    <article>
      <span class="metric-icon"><Icon name="activity" size={23} /></span>
      <span class="metric-copy">
        <small>Localization keys</small>
        <strong>{alienData.counts.localizationEntries.toLocaleString('en')}</strong>
        <em>English source corpus</em>
      </span>
      <i>04</i>
    </article>
  </div>

  <div class="data-grid">
    <section class="panel species-panel">
      <header class="panel-header">
        <div>
          <span class="eyebrow">Language matrix</span>
          <h2>Species Distribution</h2>
        </div>
        <span class="panel-index">A / 05</span>
      </header>

      <div class="species-grid">
        {#each alienData.races as race, index}
          <article style={`--race-accent: ${RACE_META[race.name].accent}`}>
            <div class="species-topline">
              <span class="species-icon"><RaceGlyph race={race.name} size={47} /></span>
              <span class="species-count">{translationEngine.getRaceCount(race.name).toLocaleString('en')}</span>
            </div>
            <h3>{race.name}</h3>
            <small>{RACE_META[race.name].designation}</small>
            <p>{RACE_META[race.name].description}</p>
            <div class="species-meter"><i style={`width: ${(translationEngine.getRaceCount(race.name) / 1200) * 100}%`}></i></div>
            <footer>
              <span>MODEL / {RACE_META[race.name].speechModel}</span>
              <span>0{index + 1}</span>
            </footer>
          </article>
        {/each}
      </div>
    </section>

    <section class="panel category-panel">
      <header class="panel-header">
        <div>
          <span class="eyebrow">Semantic groups</span>
          <h2>Category Index</h2>
        </div>
        <span class="panel-index">B / {categoryCounts.length}</span>
      </header>

      <div class="category-list">
        {#each categoryCounts as [name, count], index}
          <div class:threat={name === 'THREAT'}>
            <span class="category-rank">0{index + 1}</span>
            <span class="category-name">{name}</span>
            <span class="category-meter"><i style={`width: ${(count / maxCategoryCount) * 100}%`}></i></span>
            <strong>{count.toLocaleString('en')}</strong>
          </div>
        {/each}
      </div>
    </section>

    <section class="panel source-panel">
      <header class="panel-header">
        <div>
          <span class="eyebrow">Extraction record</span>
          <h2>Source Manifest</h2>
        </div>
        <span class="panel-index">C / 01</span>
      </header>

      <div class="source-list">
        <div>
          <span class="source-icon"><Icon name="clipboard" size={18} /></span>
          <span>
            <small>Alien speech table</small>
            <strong>{alienData.sources.speechTable.split('!/')[0]}</strong>
            <code>{alienData.sources.speechTable.split('!/')[1]}</code>
          </span>
          <em>SHA {alienData.sources.speechTableSha256.slice(0, 12)}…</em>
        </div>
        <div>
          <span class="source-icon"><Icon name="terminal" size={18} /></span>
          <span>
            <small>Generator executable</small>
            <strong>{alienData.sources.executable}</strong>
            <code>Local NMS.exe / speech Id + Race seed</code>
          </span>
          <em>SHA {alienData.sources.executableSha256.slice(0, 12)}…</em>
        </div>
        <div>
          <span class="source-icon"><Icon name="book" size={18} /></span>
          <span>
            <small>English localization</small>
            <strong>{alienData.sources.englishLocalisation.split('/').at(-1)}</strong>
            <code>English MBIN phrase corpus</code>
          </span>
          <em>READ ONLY</em>
        </div>
      </div>

      <footer class="generated-stamp">
        <span>
          <small>Archive generated</small>
          <strong>{generatedDate}</strong>
        </span>
        <span>
          <small>Generator</small>
          <strong>{alienData.generator} v{alienData.generatorVersion}</strong>
        </span>
        <span>
          <small>Unique surfaces</small>
          <strong>{alienData.counts.uniqueSurfaces.toLocaleString('en')}</strong>
        </span>
        <span>
          <small>Ambiguous surface pairs</small>
          <strong>{alienData.counts.ambiguousRaceSurfacePairs.toLocaleString('en')}</strong>
        </span>
      </footer>
    </section>

    <section class="panel privacy-panel">
      <header class="panel-header">
        <div>
          <span class="eyebrow">Runtime architecture</span>
          <h2>Local by Design</h2>
        </div>
        <span class="panel-index">D / 03</span>
      </header>

      <div class="privacy-flow">
        <div>
          <span><Icon name="keyboard" size={25} /></span>
          <strong>Input</strong>
          <small>Text remains in memory</small>
        </div>
        <i><Icon name="arrow-right" size={18} /></i>
        <div>
          <span><Icon name="terminal" size={25} /></span>
          <strong>Decode</strong>
          <small>Indexed with Web Crypto-era JS</small>
        </div>
        <i><Icon name="arrow-right" size={18} /></i>
        <div>
          <span><Icon name="check" size={25} /></span>
          <strong>Output</strong>
          <small>Never transmitted</small>
        </div>
      </div>

      <div class="privacy-note">
        <Icon name="info" size={18} />
        <p>
          No account, remote API, analytics, telemetry, or translation service is used.
          Closing the tab discards all transient input.
        </p>
      </div>
    </section>
  </div>
</section>

<style>
  .data-view {
    width: min(1600px, 100%);
    min-height: calc(100svh - 114px);
    margin: 0 auto;
    padding: 42px clamp(28px, 4vw, 64px) 34px;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .68rem;
    font-weight: 600;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 27px;
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
  }

  .offline-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 180px;
    padding: 11px 17px;
    border: 1px solid rgba(101, 230, 198, .25);
    color: #78e2bf;
    background: rgba(7, 55, 45, .27);
    clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
  }

  .offline-badge span {
    display: flex;
    flex-direction: column;
  }

  .offline-badge small {
    color: rgba(151, 210, 195, .65);
    font-family: var(--font-body);
    font-size: .52rem;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .offline-badge strong {
    margin-top: 3px;
    font-size: .8rem;
    font-weight: 500;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .metric-grid article {
    position: relative;
    display: grid;
    grid-template-columns: 49px 1fr;
    align-items: center;
    gap: 11px;
    min-height: 112px;
    padding: 18px;
    overflow: hidden;
    border: 1px solid rgba(112, 193, 209, .18);
    background: linear-gradient(140deg, rgba(6, 15, 31, .8), rgba(5, 10, 22, .5));
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
  }

  .metric-grid article::after {
    content: '';
    position: absolute;
    right: -30px;
    bottom: -40px;
    width: 100px;
    height: 100px;
    border: 1px solid rgba(91, 213, 229, .08);
    border-radius: 50%;
  }

  .metric-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 1px solid rgba(91, 213, 229, .22);
    color: var(--signal-cyan);
    transform: rotate(45deg);
  }

  .metric-icon :global(svg) {
    transform: rotate(-45deg);
  }

  .metric-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .metric-copy small,
  .metric-copy em {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .64rem;
    font-style: normal;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .metric-copy strong {
    margin: 3px 0 2px;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: 1.45rem;
    font-weight: 300;
    letter-spacing: .05em;
  }

  .metric-copy strong b {
    color: var(--text-muted);
    font-size: .65rem;
    font-weight: 400;
  }

  .metric-grid article > i {
    position: absolute;
    right: 12px;
    top: 9px;
    color: rgba(255, 216, 75, .23);
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-style: normal;
  }

  .data-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, .75fr);
    gap: 10px;
  }

  .panel {
    min-width: 0;
    border: 1px solid rgba(112, 193, 209, .18);
    background: rgba(4, 10, 23, .63);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 69px;
    padding: 13px 20px;
    border-bottom: 1px solid rgba(112, 193, 209, .17);
  }

  .panel-header h2 {
    margin-top: 5px;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 300;
    letter-spacing: .11em;
    text-transform: uppercase;
  }

  .panel-index {
    color: var(--signal-yellow);
    font-family: var(--font-body);
    font-size: .55rem;
    letter-spacing: .14em;
  }

  .species-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .species-grid article {
    position: relative;
    min-width: 0;
    min-height: 240px;
    padding: 20px 16px 15px;
    border-right: 1px solid rgba(112, 193, 209, .11);
    background: linear-gradient(180deg, color-mix(in srgb, var(--race-accent) 5%, transparent), transparent 45%);
  }

  .species-grid article:last-child {
    border-right: 0;
  }

  .species-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .species-icon {
    color: var(--race-accent);
  }

  .species-count {
    color: var(--race-accent);
    font-family: var(--font-body);
    font-size: .62rem;
    letter-spacing: .08em;
  }

  .species-grid h3 {
    margin-top: 15px;
    color: var(--text-primary);
    font-size: .9rem;
    font-weight: 400;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .species-grid article > small {
    display: block;
    margin-top: 4px;
    color: var(--race-accent);
    font-family: var(--font-body);
    font-size: .62rem;
    letter-spacing: .11em;
  }

  .species-grid p {
    min-height: 54px;
    margin-top: 12px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .6rem;
    line-height: 1.5;
  }

  .species-meter,
  .category-meter {
    position: relative;
    display: block;
    height: 3px;
    overflow: hidden;
    background: rgba(255, 255, 255, .07);
  }

  .species-meter {
    margin-top: 12px;
  }

  .species-meter i {
    position: absolute;
    inset: 0 auto 0 0;
    max-width: 100%;
    background: var(--race-accent);
    box-shadow: 0 0 7px var(--race-accent);
  }

  .species-grid footer {
    display: flex;
    justify-content: space-between;
    margin-top: 13px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    letter-spacing: .08em;
  }

  .category-list {
    display: grid;
    gap: 3px;
    padding: 13px 18px 18px;
  }

  .category-list > div {
    display: grid;
    grid-template-columns: 26px 76px 1fr 45px;
    align-items: center;
    gap: 8px;
    min-height: 37px;
  }

  .category-rank {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .5rem;
  }

  .category-name,
  .category-list strong {
    font-family: var(--font-body);
    font-size: .55rem;
    letter-spacing: .09em;
  }

  .category-name {
    color: #83dce8;
  }

  .category-list strong {
    color: var(--text-muted);
    text-align: right;
  }

  .category-meter i {
    position: absolute;
    inset: 0 auto 0 0;
    background: #58cddd;
    box-shadow: 0 0 5px rgba(88, 205, 221, .4);
  }

  .category-list > div.threat .category-name {
    color: #ff9684;
  }

  .category-list > div.threat .category-meter i {
    background: #ff785f;
  }

  .source-panel {
    min-height: 325px;
  }

  .source-list {
    display: grid;
    padding: 7px 20px;
  }

  .source-list > div {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 77px;
    border-bottom: 1px solid rgba(112, 193, 209, .1);
  }

  .source-list > div:last-child {
    border-bottom: 0;
  }

  .source-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgba(112, 193, 209, .18);
    color: var(--signal-cyan);
  }

  .source-list > div > span:nth-child(2) {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .source-list small {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .source-list strong {
    margin-top: 3px;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: .62rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-list code {
    margin-top: 3px;
    color: rgba(119, 188, 201, .53);
    font-family: var(--font-body);
    font-size: .5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-list em {
    color: var(--signal-yellow);
    font-family: var(--font-body);
    font-size: .62rem;
    font-style: normal;
    letter-spacing: .08em;
  }

  .generated-stamp {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 15px 20px;
    border-top: 1px solid rgba(112, 193, 209, .14);
    background: rgba(7, 18, 34, .5);
  }

  .generated-stamp > span {
    display: flex;
    flex-direction: column;
  }

  .generated-stamp small {
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    letter-spacing: .11em;
    text-transform: uppercase;
  }

  .generated-stamp strong {
    margin-top: 4px;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: .57rem;
    font-weight: 500;
  }

  .privacy-panel {
    min-height: 325px;
  }

  .privacy-flow {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    padding: 26px 18px 22px;
  }

  .privacy-flow > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    text-align: center;
  }

  .privacy-flow > div > span {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-bottom: 10px;
    border: 1px solid rgba(112, 193, 209, .22);
    color: var(--signal-cyan);
    transform: rotate(45deg);
  }

  .privacy-flow > div > span :global(svg) {
    transform: rotate(-45deg);
  }

  .privacy-flow strong {
    color: var(--text-primary);
    font-size: .72rem;
    font-weight: 400;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .privacy-flow small {
    margin-top: 4px;
    color: var(--text-dim);
    font-family: var(--font-body);
    font-size: .62rem;
    line-height: 1.35;
  }

  .privacy-flow > i {
    color: rgba(112, 193, 209, .35);
  }

  .privacy-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 18px 18px;
    padding: 13px;
    border: 1px solid rgba(101, 230, 198, .14);
    color: #76dcb9;
    background: rgba(6, 45, 38, .24);
  }

  .privacy-note p {
    color: rgba(170, 208, 197, .65);
    font-family: var(--font-body);
    font-size: .57rem;
    line-height: 1.55;
  }

  @media (max-width: 1200px) {
    .metric-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .data-grid {
      grid-template-columns: 1fr;
    }

    .species-grid {
      grid-template-columns: repeat(5, minmax(150px, 1fr));
      overflow-x: auto;
    }
  }

  @media (max-width: 700px) {
    .data-view {
      padding: 28px 14px 22px;
    }

    .page-header p {
      display: none;
    }

    .offline-badge {
      min-width: 0;
      padding: 8px 12px;
    }

    .offline-badge span {
      display: none;
    }

    .metric-grid {
      grid-template-columns: 1fr 1fr;
    }

    .metric-grid article {
      grid-template-columns: 39px 1fr;
      min-height: 95px;
      padding: 12px;
    }

    .metric-icon {
      width: 38px;
      height: 38px;
    }

    .metric-copy strong {
      font-size: 1.05rem;
    }

    .metric-copy em {
      display: none;
    }

    .species-grid {
      grid-template-columns: repeat(5, 155px);
    }

    .privacy-flow {
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .privacy-flow > i {
      transform: rotate(90deg);
    }

    .source-list > div {
      grid-template-columns: 35px 1fr;
    }

    .source-list em {
      display: none;
    }
  }
</style>
