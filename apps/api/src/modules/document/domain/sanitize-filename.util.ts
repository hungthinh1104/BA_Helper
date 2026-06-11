/**
 * Sanitizes a string to be used as a safe ASCII filename.
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters (including unicode/diacritics if easily mapped, or strips them) with hyphens
 * - Collapses multiple hyphens into a single hyphen
 * - Trims hyphens from the start and end
 * - Enforces a maximum length of 80 characters
 * - Appends '-impact-report.md' (or a fallback if empty)
 */
export function sanitizeReportFilename(title: string): string {
  if (!title || typeof title !== 'string') {
    return 'impact-report.md';
  }

  // Basic diacritics removal
  let safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Convert to lowercase
  safe = safe.toLowerCase();

  // Replace any non-alphanumeric character with a hyphen
  safe = safe.replace(/[^a-z0-9]+/g, '-');

  // Collapse multiple hyphens and trim from ends
  safe = safe.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Truncate to a reasonable length (e.g., 50 chars for the title part) to leave room for the suffix
  if (safe.length > 50) {
    safe = safe.substring(0, 50).replace(/-$/, '');
  }

  if (!safe) {
    return 'impact-report.md';
  }

  return `${safe}-impact-report.md`;
}
