import rawArchive from '../../data/alien-words.json';
import { TranslationEngine } from './translator';
import type { AlienArchive } from './types';

export const SUPPORTED_ARCHIVE_SCHEMA = 2;

const archive = rawArchive as unknown as AlienArchive;

if (archive.schema !== SUPPORTED_ARCHIVE_SCHEMA) {
  throw new Error(
    `Unsupported alien archive schema ${archive.schema}. Expected schema ${SUPPORTED_ARCHIVE_SCHEMA}.`,
  );
}

export const alienData = archive;
export const translationEngine = new TranslationEngine(alienData);
