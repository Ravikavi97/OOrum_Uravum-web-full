import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent stored XSS attacks.
 * Allows safe HTML tags (formatting, links, images) but strips scripts and event handlers.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'img',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span', 'hr', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
      'width', 'height', 'style',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text — strips ALL HTML tags.
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
