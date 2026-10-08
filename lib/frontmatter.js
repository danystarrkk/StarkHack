import { load } from "js-yaml";

// Soporta CRLF y cierre de bloque sin salto de línea final
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse the YAML frontmatter of a raw markdown document.
 * Shared by the build-time indexer (Node) and the runtime app (Vite/TS).
 *
 * The result is generic so callers can request a narrower shape without
 * unsafe type assertions, e.g. `parseFrontmatter<Partial<WriteupContent>>(text)`.
 *
 * @template [T=Record<string, unknown>]
 * @param {string} text raw markdown file contents
 * @returns {{ data: T, content: string }}
 */
export function parseFrontmatter(text) {
  // Un BOM UTF-8 (típico de Windows / algunos editores) no debe ocultar el
  // bloque: lo strippeamos antes de matchear.
  const normalized = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const match = normalized.match(FRONTMATTER_RE);

  // Sin frontmatter: devolvemos el texto tal cual
  if (!match) return { data: /** @type {T} */ ({}), content: text };

  const yamlRaw = match[1];
  const content = match[2];

  // Un bloque vacío o con solo comentarios no es YAML roto: es un frontmatter
  // sin metadatos (estado legítimo de authoring). js-yaml 5 tira sobre entrada
  // vacía, así que lo resolvemos nosotros sin perder el fail-loud real.
  const isBlankBlock = yamlRaw
    .split(/\r?\n/)
    .every((line) => line.trim() === "" || line.trim().startsWith("#"));
  if (isBlankBlock) return { data: /** @type {T} */ ({}), content };

  let parsed;
  try {
    parsed = load(yamlRaw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    // js-yaml 5 tira "expected a document" cuando el bloque no produce ningún
    // documento: marcador `...`, directivas sin cuerpo… Eso es un frontmatter
    // sin metadatos, no YAML roto, así que devolvemos vacío y deja en manos del
    // validador de campos el decirle al autor qué le falta (con su filePath).
    // Los errores reales (flujo sin cerrar, sangría inválida…) conservan su
    // motivo original y siguen tirando.
    if (/expected a document/i.test(reason)) {
      return { data: /** @type {T} */ ({}), content };
    }

    // Fallar ruidosamente: el frontmatter YAML es inválido
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

  return { data: /** @type {T} */ (data), content };
}
