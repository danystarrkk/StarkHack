import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseFrontmatter } from "../lib/frontmatter.js";
import { assertRequiredTags, assertValidTags } from "../lib/taxonomy.js";
import { KINDS, assertValidGroup, missingFields } from "../lib/content-kinds.js";
import { WRITEUP_LEVELS } from "../lib/content-ingest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");

const OUTPUT_FILE = path.join(REPO_ROOT, "public/index.json");

// Raíces por defecto: el registro KINDS (lib/content-kinds.js) es la fuente única
// de verdad, resuelta contra el repo. Las raíces inexistentes se toleran.
const DEFAULT_ROOTS = Object.fromEntries(
  Object.entries(KINDS).map(([kind, spec]) => [kind, path.join(REPO_ROOT, spec.root)])
);

// --- escaneo de fuentes -------------------------------------------------------

// Writeups: barrido exacto de dos niveles <root>/<platform>/*.md, como siempre.
// Las entradas sueltas en la raíz (no directorios) se ignoran.
// El orden de `readdirSync` no está garantizado por POSIX: ordenamos siempre
// por nombre (ascendente) antes de iterar, así el índice depende solo de los
// nombres y las fechas, nunca del orden del sistema de archivos (byte-estable).
function platformedFiles(rootDir) {
  const out = [];
  for (const platform of fs.readdirSync(rootDir).sort()) {
    const platformPath = path.join(rootDir, platform);
    if (!fs.statSync(platformPath).isDirectory()) continue;
    const fileNames = fs
      .readdirSync(platformPath)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const fileName of fileNames) {
      out.push({ filePath: path.join(platformPath, fileName), platform, fileName });
    }
  }
  return out;
}

// Tipos planos (projects, certificates): <root>/*.md, sin nivel de plataforma.
// Igual que arriba: la lista se ordena por nombre antes de iterar para que la
// salida sea independiente del orden de readdirSync.
function flatFiles(rootDir) {
  return fs
    .readdirSync(rootDir)
    .filter((f) => f.endsWith(".md") && fs.statSync(path.join(rootDir, f)).isFile())
    .sort()
    .map((fileName) => ({ filePath: path.join(rootDir, fileName), fileName }));
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  try {
    return parseFrontmatter(content).data;
  } catch (error) {
    // Re-lanzamos con el path: sin contexto no se sabe qué archivo rompe el índice
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${filePath}: ${reason}`);
  }
}

// La ruta en el sitio espeja la raíz del tipo en KINDS: 'public/writeups' →
// '/writeups'. Así los fixtures temporales generan rutas de sitio reales.
function entryPath(spec, platform, fileName) {
  const urlRoot = "/" + spec.root.replace(/^public\//, "");
  return spec.platformed ? `${urlRoot}/${platform}/${fileName}` : `${urlRoot}/${fileName}`;
}

// El `order` del certificado debe ser un entero real y único: gobierna el orden
// público de visualización. Un duplicado es un error duro.
function validateCertificateOrder(order, filePath, orderOwners) {
  if (!Number.isInteger(order)) {
    const shown = typeof order === "string" ? JSON.stringify(order) : String(order);
    throw new Error(
      `Invalid certificate order in ${filePath}: expected an integer, got ${shown}`
    );
  }
  const previous = orderOwners.get(order);
  if (previous) {
    throw new Error(
      `Duplicate certificate order in ${filePath}: ${order} is already used by ${previous}`
    );
  }
  orderOwners.set(order, filePath);
}

// --- ordenación ---------------------------------------------------------------

// Orden del índice (contrato documentado):
//   1. Las entradas con `date` interpretable van primero, más recientes primero.
//   2. Las entradas sin fecha (o con fecha ilegible) ordenan al final.
//   3. Clave secundaria dentro de la misma fecha: los certificados usan su
//      `order` (ascendente), así la cola sin fecha queda en orden de
//      visualización; el resto de tipos comparte una clave secundaria constante
//      y por tanto conserva el orden de escaneo (Array#sort es estable) — que
//      es orden de nombre de archivo ascendente, porque la lista de archivos se
//      ordena explícitamente antes de iterar (readdirSync no garantiza orden).
//      Así regenerar el índice es byte-estable en cualquier máquina.
function dateKey(entry) {
  if (typeof entry.date !== "string" || entry.date.trim() === "") return null;
  const time = new Date(entry.date).getTime();
  return Number.isNaN(time) ? null : time;
}

function orderKey(entry) {
  return entry.kind === "certificate" && Number.isInteger(entry.order)
    ? entry.order
    : Number.POSITIVE_INFINITY;
}

function sortIndex(index) {
  index.sort((a, b) => {
    const dateA = dateKey(a);
    const dateB = dateKey(b);
    if (dateA !== dateB) {
      if (dateA === null) return 1; // sin fecha: al final
      if (dateB === null) return -1;
      return dateB - dateA; // con fecha: más recientes primero
    }
    const orderA = orderKey(a);
    const orderB = orderKey(b);
    return orderA !== orderB ? orderA - orderB : 0;
  });
  return index;
}

// --- indexado -----------------------------------------------------------------

/**
 * Build the content index from up to three content roots.
 *
 * `source` maps content kinds (KINDS keys) to their root directory:
 *   generateIndex({ writeup: '…/public/writeups', project: '…/public/projects', certificate: '…/public/certificates' })
 * A plain string is accepted as shorthand for `{ writeup: <dir> }`, the original
 * single-kind call shape. Kinds without a directory — and roots that do not
 * exist on disk — are simply skipped (no crash, no entries).
 *
 * @param {string | Partial<Record<string, string>>} source content roots by kind
 * @returns {Record<string, unknown>[]} index entries
 */
export function generateIndex(source) {
  const sources = typeof source === "string" ? { writeup: source } : source ?? {};
  const index = [];
  const orderOwners = new Map(); // certificate `order` → filePath, para unicidad

  for (const [kind, spec] of Object.entries(KINDS)) {
    const rootDir = sources[kind];
    if (!rootDir || !fs.existsSync(rootDir)) continue;

    const files = spec.platformed ? platformedFiles(rootDir) : flatFiles(rootDir);

    for (const { filePath, platform, fileName } of files) {
      const data = readFrontmatter(filePath);

      // skip drafts reales (antes de validar: un draft sin publicar no necesita metadata)
      if (data.draft === true) continue;

      // Taxonomías cerradas por kind (fail-loud con filePath, después del
      // skip de drafts: un draft sin publicar no necesita metadata):
      // - writeup: tags opcionales, ⊆ TAGS.
      // - project/certificate: `group` obligatorio de la lista del kind y
      //   tags ≥1 del vocabulario propio del kind.
      if (kind === "writeup") {
        assertValidTags(data.tags, filePath);
        // El cover del UI se deriva del level (Easy|Medium|Hard): un valor
        // fuera del vocabulario rompería ese cover en silencio. Validación
        // opcional — level NO es required, pero si está debe ser exacto.
        if (data.level !== undefined && data.level !== null) {
          const listed = WRITEUP_LEVELS.map((entry) => JSON.stringify(entry)).join(", ");
          const shown = typeof data.level === "string" ? data.level : String(data.level);
          if (!WRITEUP_LEVELS.includes(data.level)) {
            throw new Error(
              `Invalid writeup level in ${filePath}: expected one of ${listed}, got ${JSON.stringify(shown)}.`
            );
          }
        }
      } else {
        assertValidGroup(data.group, kind, filePath);
        assertRequiredTags(data.tags, kind, filePath);
      }

      const missing = missingFields(data, kind);
      if (missing.length > 0) {
        throw new Error(
          `Missing required frontmatter field(s) in ${filePath}: ${missing.join(", ")}`
        );
      }

      if (kind === "certificate") validateCertificateOrder(data.order, filePath, orderOwners);

      index.push({
        ...data,
        kind,
        ...(spec.platformed ? { platform } : {}),
        slug: fileName.replace(/\.md$/, ""),
        path: entryPath(spec, platform, fileName),
      });
    }
  }

  return sortIndex(index);
}

// Resumen del CLI. Con solo writeups la línea es idéntica a la previa a los
// kinds ("Generated index.json with N writeups."); los demás tipos solo se
// mencionan cuando aportan entradas.
function describeCounts(index) {
  const counts = { writeup: 0, project: 0, certificate: 0 };
  for (const entry of index) {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  }
  const parts = [`${counts.writeup} writeup${counts.writeup === 1 ? "" : "s"}`];
  for (const kind of ["project", "certificate"]) {
    if (counts[kind] > 0) parts.push(`${counts[kind]} ${kind}${counts[kind] === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

// CLI: node scripts/generate-index.js → escribe public/index.json
// runCli queda exportada para poder ejercitar el camino de error sin tocar public/
export function runCli(source = DEFAULT_ROOTS, outputFile = OUTPUT_FILE) {
  try {
    const index = generateIndex(source);

    fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));

    console.log(`Generated index.json with ${describeCounts(index)}.`);
  } catch (error) {
    // Fallo limpio: una sola línea en stderr y exit 1, sin stack trace
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
