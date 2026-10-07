/**
 * Path validation for custom category routes.
 *
 * A custom path maps a category to a top-level URL (e.g. `/obituary` instead of
 * `/category/slug`). This is used for special sections like the obituary
 * directory that should appear at a dedicated URL rather than under the
 * standard `/category/{slug}` pattern.
 *
 * Rules:
 * - Must start with a single leading `/`
 * - Must contain only lowercase letters, digits, and hyphens
 * - Must not start or end with a hyphen
 * - Must not contain consecutive hyphens
 * - Must be 1-100 characters long (excluding leading `/`)
 */

const PATH_REGEX = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate that a custom path is well-formed.
 * Returns true if valid, false otherwise.
 */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const trimmed = path.trim();

  // Must start with /
  if (!trimmed.startsWith('/')) {
    return false;
  }

  // Length check (excluding leading /)
  const content = trimmed.slice(1);
  if (content.length === 0 || content.length > 100) {
    return false;
  }

  // Must match the strict pattern
  return PATH_REGEX.test(trimmed);
}