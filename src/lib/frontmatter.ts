// Isomorphic, dependency-free frontmatter handling for the simple YAML subset
// the notes use: flat `key: value` pairs plus an inline tags array literal.
// Shared by the API routes, the React editor, and the search index.

export interface ParsedFrontmatter {
  data: Record<string, string | string[]>;
  body: string;
}

const FRONTMATTER_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

/** Strip one layer of surrounding quotes. */
function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parses a raw markdown document into frontmatter data and body. CRLF-tolerant.
 * Values are unquoted strings, except inline array literals (e.g. tags), which
 * become string arrays. Documents without frontmatter return `data: {}` and
 * the whole input as `body`.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) return { data: {}, body: raw };

  const [, frontmatterStr, body] = match;
  const data: Record<string, string | string[]> = {};

  for (const line of frontmatterStr.split(/\r?\n/)) {
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;
    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = parseTagsValue(value);
    } else {
      data[key] = unquote(value);
    }
  }

  return { data, body };
}

/** Serializes data + body back into a markdown document with quoted values. */
export function serializeFrontmatter(
  data: Record<string, string | string[]>,
  body: string
): string {
  const lines = Object.entries(data).map(([key, value]) =>
    Array.isArray(value) ? `${key}: ${tagsToLiteral(value)}` : `${key}: "${value}"`
  );
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

// Tags are edited as a friendly comma list but stored as the array literal the
// existing notes use (e.g. ["ai","product"]). These convert between the two.
export function parseTagsValue(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (!raw) return [];
  let s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      s = s.slice(1, -1);
    }
  }
  return s
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

export function tagsToLiteral(tags: string[]): string {
  return `[${tags.map((t) => `"${t.replace(/"/g, '')}"`).join(',')}]`;
}
