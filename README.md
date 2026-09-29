# No Man's Sky Translator

**Live site:** https://nms-translator.pages.dev

Translate the alien languages from No Man's Sky. It is a small website that runs
entirely in your browser. Nothing is uploaded and the game does not need to be
installed.

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://cdn.goygoyengine.com/images/banner-2-1790671908158-26091805ceb3.webp">
        <img src="https://cdn.goygoyengine.com/images/banner-2-1790671908158-26091805ceb3.webp" alt="Translate view" width="100%">
      </a>
      <br>
      <sub>Translate</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://cdn.goygoyengine.com/images/banner-1-1790671906311-029898978d89.webp">
        <img src="https://cdn.goygoyengine.com/images/banner-1-1790671906311-029898978d89.webp" alt="NPC dialogue view" width="100%">
      </a>
      <br>
      <sub>NPC dialogue</sub>
    </td>
  </tr>
</table>

## Features

- **Translate** - type a sentence and read it in English or in an alien language.
- **Scan a screenshot** - paste a screenshot from the game and the text is read for you.
- **Phrasebook** - search every word by English, alien, or topic.
- **NPC dialogue** - a talk screen for each species.

Supported species: Gek, Korvax, Vy'keen, Atlas, Autophage.

## About the data

The words are taken from the game's own data files and its word generator, not
written by hand. Because the game makes many words for one meaning, some words have
several translations. The app shows how confident it is, so you know when to
double-check.

The word lists are stored in this repo, so the site works without the game. They
match game version **Cosmos 7.04**.

## Getting started

Needs [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev
```

## Notes

- The screenshot scan uses [tesseract.js](https://github.com/naptha/tesseract.js) OCR. It downloads about 8 MB the first time you
  use it. Everything else works offline.
- `tools/process_npc_assets.py` rebuilds the NPC artwork. It is optional and needs
  `opencv-python`, `numpy`, `scipy`, `Pillow`, `matplotlib`.
- The word lists can be used here, but not regenerated. The extraction tool is not
  part of this repo.

## Disclaimer

Unofficial fan project. Not affiliated with or endorsed by Hello Games.
No Man's Sky is a trademark of Hello Games.

The word lists and the game assets in this repository belong to Hello Games.
