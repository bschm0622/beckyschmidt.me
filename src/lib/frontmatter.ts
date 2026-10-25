export interface ParsedFrontmatter {
  data: Record<string, string | string[]>;
  body: string;
}

const FRONTMATTER_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

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

export function serializeFrontmatter(
  data: Record<string, string | string[]>,
  body: string
): string {
  const lines = Object.entries(data).map(([key, value]) =>
    // JSON string syntax is valid YAML double-quoted syntax, so quotes and backslashes stay escaped.
    Array.isArray(value) ? `${key}: ${tagsToLiteral(value)}` : `${key}: ${JSON.stringify(value)}`
  );
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

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
