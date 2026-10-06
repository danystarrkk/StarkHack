import { load } from "js-yaml";

// Soporta CRLF y cierre de bloque sin salto de línea final
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse the YAML frontmatter of a raw markdown document.
 * Shared by the build-time indexer (Node) and the runtime app (Vite/TS).
 *
 * @param {string} text raw markdown file contents
 * @returns {{ data: Record<string, any>, content: string }}
 */
export function parseFrontmatter(text) {
  const match = text.match(FRONTMATTER_RE);

  // Sin frontmatter: devolvemos el texto tal cual
  if (!match) return { data: {}, content: text };

  const yamlRaw = match[1];
  const content = match[2];

  let parsed;
  try {
    parsed = load(yamlRaw);
  } catch (error) {
    // Fallar ruidosamente: el frontmatter YAML es inválido
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML frontmatter: ${reason}`);
  }

  // Bloque vacío o que no parsea a un objeto (null, escalar, array...) → sin datos
  const isPlainObject =
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    !(parsed instanceof Date);
  const data = isPlainObject ? parsed : {};

  // js-yaml parsea los timestamps como Date; normalizamos a "YYYY-MM-DD"
  if (data.date instanceof Date) {
    data.date = data.date.toISOString().slice(0, 10);
  }

  return { data, content };
}
