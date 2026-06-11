import sanitizeHtml from 'sanitize-html';

export function wrapLongTokens(value: string) {
  return value
    .split(/\s+/)
    .map((token) => {
      if (token.length < 28) {
        return token;
      }

      return token.replace(/([/\\._:\-?&=])/g, '$1\u200b');
    })
    .join(' ');
}

export function sanitizeCode(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

export function sanitizeInline(value: string) {
  return wrapLongTokens(
    sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    })
      .replace(/\s+/g, ' ')
      .trim(),
  );
}
