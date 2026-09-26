/**
 * App-level metadata that is not carried by the generated archive.
 *
 * The extractor output (data/alien-words.json) intentionally contains only
 * machine-derived fields, so the reviewed game version lives here. Update this
 * single constant when the archive is regenerated against a new update.
 */
export const GAME_VERSION = 'Cosmos 7.04';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Formats the archive timestamp as "25 Sep 2026".
 * Built manually so the day-month order and the 3-letter month never depend
 * on the runtime's default locale.
 */
export function formatArchiveDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
