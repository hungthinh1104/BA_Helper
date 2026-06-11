/**
 * Sanitizes a string to be used as a safe ASCII filename.
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters (including unicode/diacritics if easily mapped, or strips them) with hyphens
 * - Collapses multiple hyphens into a single hyphen
 * - Trims hyphens from the start and end
 * - Enforces a maximum length of 80 characters
 * - Returns a safe basename that can be suffixed by the caller with a format extension
 */
export function sanitizeReportBasename(title: string): string {
  if (!title || typeof title !== 'string') {
    return 'impact-report';
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
    return 'impact-report';
  }

  return `${safe}-impact-report`;
}

export function sanitizeReportFilename(
  title: string,
  extension: 'md' | 'pdf' = 'md',
): string {
  return `${sanitizeReportBasename(title)}.${extension}`;
}
