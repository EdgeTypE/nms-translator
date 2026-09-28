/**
 * Single source of truth for the site's static pages.
 *
 * Each entry produces a real HTML file (GitHub Pages serves directory
 * indexes, e.g. /phrasebook/ -> phrasebook/index.html), so crawlers receive
 * genuinely different documents instead of one shell with a ?view= query.
 *
 * The generated files all load the SAME src/main.ts bundle; the initial view
 * is resolved at runtime from the pathname (see src/lib/routing.ts).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Reverse word-index files loaded into every page. manifest.js first: it names
 * the per-species files, so the loader needs it before the first race is picked.
 */
const WORD_INDEX_BOOTSTRAP = ['manifest.js', 'words.js'];

/** Public origin, overridable for forks/deployments. */
const SITE_ORIGIN = (process.env.VITE_SITE_ORIGIN ?? 'https://nms-translator.pages.dev')
  .replace(/\/+$/, '');

export const PAGES = [
  {
    id: 'translate',
    dir: '',
    nav: 'Translate',
    title: "Alien Translator — No Man's Sky",
    description:
      'Translate Gek, Korvax, Vy’keen, Atlas and Autophage text in No Man\'s Sky. Runs entirely in your browser from a 4,830-entry game-accurate lexicon.',
    h1: "No Man's Sky Alien Translator",
    intro:
      'Translate every major alien language in No Man’s Sky. Type alien text to decode it into English, or enter English to speak alien — processed entirely on your own device.',
    keywords: [
      'No Man\'s Sky translator',
      'alien language translator',
      'Gek translator',
      'Korvax translator',
      'Vy\'keen translator',
      'NMS alien decoder',
    ],
  },
  {
    id: 'phrasebook',
    dir: 'phrasebook',
    nav: 'Phrasebook',
    title: "Alien Phrasebook — No Man's Sky Translator",
    description:
      'Search all 4,830 No Man\'s Sky alien speech entries by English or alien text. Includes every generated surface form for Gek, Korvax, Vy’keen, Atlas and Autophage.',
    h1: 'No Man’s Sky Alien Phrasebook',
    intro:
      'Search every indexed alien word. Look up an English term to see its exact game-generated alien surface, or search alien text directly to find its meaning.',
    keywords: [
      'No Man\'s Sky phrasebook',
      'alien word list',
      'Gek words',
      'Korvax words',
      'NMS alien dictionary',
    ],
  },
  {
    id: 'npc',
    dir: 'npc',
    nav: 'NPC Dialogue',
    title: "Talk to Aliens — No Man's Sky NPC Dialogue",
    description:
      'A full-screen No Man\'s Sky NPC dialogue view. Speak to Gek, Korvax, Vy’keen, Atlas and Autophage with live alien-to-English translation.',
    h1: 'No Man’s Sky NPC Dialogue',
    intro:
      'Talk to an alien face to face. The NPC view decodes what they say and encodes what you type, using the same game-accurate lexicon as the translator.',
    keywords: ['No Man\'s Sky NPC dialogue', 'talk to aliens', 'alien conversation'],
  },
];

const FONTS = [
  'rajdhani-300.woff2',
  'rajdhani-400.woff2',
  'rajdhani-500.woff2',
  'rajdhani-600.woff2',
  'rajdhani-700.woff2',
  'roboto-400.woff2',
];

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Builds the noscript fallback: real, readable content for non-JS crawlers. */
function noscriptBlock(page, allPages) {
  const links = allPages
    .filter((other) => other.id !== page.id)
    .map((other) => `      <li><a href="/${other.dir ? `${other.dir}/` : ''}">${escapeHtml(other.nav)}</a></li>`)
    .join('\n');

  return `    <noscript>
      <div class="noscript-shell">
        <h1>${escapeHtml(page.h1)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <p>
          The interactive translator needs JavaScript. Enable it to use the
          offline alien-to-English and English-to-alien decoders.
        </p>
        <nav aria-label="Site sections">
          <h2>Sections</h2>
          <ul>
${links}
          </ul>
        </nav>
      </div>
    </noscript>`;
}

function renderPage(page, allPages) {
  const urlPath = page.dir ? `/${page.dir}/` : '/';
  const canonical = `${SITE_ORIGIN}${urlPath}`;

  const preload = FONTS.map(
    (font) =>
      `    <link rel="preload" href="/fonts/${font}" as="font" type="font/woff2" crossorigin />`,
  ).join('\n');

  // The reverse word index. Both files assign onto window.NMS_ALIEN_INDEX rather
  // than exporting a module, so they load as plain classic scripts and land
  // before the app boots. Only the per-species files are fetched on demand, when
  // the visitor picks a race.
  const wordIndex = WORD_INDEX_BOOTSTRAP.map(
    (file) => `    <script src="/data/alien-word-index/${file}"></script>`,
  ).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="keywords" content="${escapeHtml(page.keywords.join(', '))}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="No Man's Sky Translator" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="theme-color" content="#050914" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
${preload}
${NOSCRIPT_STYLE}  </head>
  <body>
${noscriptBlock(page, allPages)}
    <div id="app"></div>
${wordIndex}
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}

async function writePage(page, allPages) {
  const outDir = page.dir ? join(ROOT, page.dir) : ROOT;
  const outFile = join(outDir, 'index.html');
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, renderPage(page, allPages), 'utf8');
  return outFile;
}

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((page) => {
    const loc = `${SITE_ORIGIN}/${page.dir ? `${page.dir}/` : ''}`;
    const priority = page.dir ? '0.7' : '1.0';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}

/** Minimal styling so the noscript fallback is still presentable. */
const NOSCRIPT_STYLE = `  <style>
    .noscript-shell {
      max-width: 42rem;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      color: #edf5f7;
      background: #03060d;
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
    }
    .noscript-shell h1 { color: #ffd83f; }
    .noscript-shell a { color: #69dbe9; }
  </style>
`;

async function main() {
  // Persist the page copy so the client router can update <title>/meta
  // during instant SPA navigation, matching the served HTML per route.
  await writeFile(
    join(ROOT, 'src', 'lib', 'pages.json'),
    `${JSON.stringify(
      PAGES.map(({ id, dir, title, description }) => ({ id, dir, title, description })),
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log('generated src/lib/pages.json');

  for (const page of PAGES) {
    const file = await writePage(page, PAGES);
    console.log(`generated ${file.replace(`${ROOT}\\`, '')}`);
  }

  await writeFile(join(ROOT, 'public', 'sitemap.xml'), renderSitemap(), 'utf8');
  await writeFile(join(ROOT, 'public', 'robots.txt'), renderRobots(), 'utf8');
  console.log('generated public/sitemap.xml, public/robots.txt');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
