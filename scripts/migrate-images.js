#!/usr/bin/env node
/**
 * Migración one-shot del vault plano `public/images/` a la convención por writeup:
 *
 *   public/writeups/<platform>/<slug>/media/cover.webp   ← frontmatter `image:`
 *   public/writeups/<platform>/<slug>/media/01.webp … NN.webp ← cuerpo, en orden
 *                                                              de primera aparición
 *   public/ui/stark.webp, public/ui/logo.webp             ← assets usados por código
 *   public/_archive/unreferenced/<nombre original>        ← huérfanos (nunca se borran)
 *
 * Uso:
 *   node scripts/migrate-images.js --dry-run   imprime el plan y valida invariantes
 *   node scripts/migrate-images.js             ejecuta los movimientos y reescribe refs
 *
 * El dry-run falla (exit 1) si algún invariante no se cumple; sin dry-run solo se
 * ejecuta cuando los invariantes pasan. Sobre un árbol ya migrado el script detecta
 * que no hay nada que hacer ("nothing to migrate", exit 0) → es idempotente.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseFrontmatter } from "../lib/frontmatter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, "../public");
const WRITEUPS_DIR = path.join(PUBLIC_DIR, "writeups");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");
const UI_DIR = path.join(PUBLIC_DIR, "ui");
const ARCHIVE_DIR = path.join(PUBLIC_DIR, "_archive", "unreferenced");

// Assets de UI usados por código (Layout.tsx, About.tsx, index.html), no por writeups
const UI_ASSETS = ["stark.webp", "logo.webp"];

// Conteos medidos: 713 referenciadas + 2 UI + 73 huérfanas = 788 ficheros
const EXPECTED = { referenced: 713, ui: 2, archived: 73, total: 788 };

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

function listWriteups() {
  const writeups = [];
  for (const platformEntry of fs.readdirSync(WRITEUPS_DIR, { withFileTypes: true })) {
    if (!platformEntry.isDirectory()) continue;
    const platformDir = path.join(WRITEUPS_DIR, platformEntry.name);
    for (const file of fs.readdirSync(platformDir)) {
      if (!file.endsWith(".md")) continue;
      writeups.push({
        platform: platformEntry.name,
        slug: file.replace(/\.md$/, ""),
        filePath: path.join(platformDir, file),
      });
    }
  }
  return writeups;
}

// `/images/Pasted%20image%201.webp` → nombre de fichero plano `Pasted image 1.webp`
function sourceName(ref) {
  return decodeURIComponent(ref.slice("/images/".length));
}

function extOf(name) {
  return path.extname(name).toLowerCase();
}

// ---------------------------------------------------------------------------
// Plan: fuentes → objetivos por writeup
// ---------------------------------------------------------------------------

function buildPlan() {
  const plan = [];
  for (const writeup of listWriteups()) {
    const raw = fs.readFileSync(writeup.filePath, "utf8");
    const { data, content } = parseFrontmatter(raw);

    // Cover: clave `image:` del frontmatter
    const coverRef = typeof data.image === "string" ? data.image.trim() : undefined;

    // Cuerpo: refs en orden de PRIMERA aparición (duplicados → mismo objetivo)
    const bodySourceOrder = []; // nombres de fichero fuente, ordenados
    const bodyTargetBySource = new Map(); // fuente → URL objetivo
    const bodyOccurrences = []; // { source, targetUrl } por cada aparición
    for (const match of content.matchAll(MD_IMAGE_RE)) {
      const ref = match[2].trim();
      const source = sourceName(ref);
      bodyOccurrences.push({ source, ref });
      if (!bodyTargetBySource.has(source)) {
        const index = bodySourceOrder.length + 1;
        bodySourceOrder.push(source);
        bodyTargetBySource.set(source, null); // placeholder: el padding depende del total
      }
    }

    // Padding al ancho del mayor índice del writeup (no hardcodeado)
    const pad = String(bodySourceOrder.length).length;
    bodySourceOrder.forEach((source, i) => {
      bodyTargetBySource.set(
        source,
        `/writeups/${writeup.platform}/${writeup.slug}/media/${String(i + 1).padStart(pad, "0")}${extOf(source)}`
      );
    });

    const coverSource = coverRef ? sourceName(coverRef) : undefined;
    const coverTarget = coverSource
      ? `/writeups/${writeup.platform}/${writeup.slug}/media/cover${extOf(coverSource)}`
      : undefined;

    plan.push({
      ...writeup,
      coverRef,
      coverSource,
      coverTarget,
      bodySourceOrder,
      bodyTargetBySource,
      bodyOccurrences,
    });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Invariantes (corren también en dry-run; cualquier fallo → exit 1)
// ---------------------------------------------------------------------------

function validateInvariants(plan) {
  // Cada invariante acumula sus propios errores → resultado por invariante
  const checks = [
    { label: "every referenced source file exists on disk", errors: [] },
    { label: "no two references map to the same target path", errors: [] },
    { label: "a cover image is not also referenced in the body", errors: [] },
    { label: "every reference starts with /images/", errors: [] },
    {
      label: `measured counts hold (${EXPECTED.referenced} referenced + ${EXPECTED.ui} UI + ${EXPECTED.archived} archived = ${EXPECTED.total} files present)`,
      errors: [],
    },
  ];
  const imageFiles = new Set(listFiles(IMAGES_DIR));

  // 1. Toda fuente referenciada existe en disco
  for (const w of plan) {
    const sources = [...w.bodySourceOrder, ...(w.coverSource ? [w.coverSource] : [])];
    for (const source of sources) {
      if (!imageFiles.has(source)) {
        checks[0].errors.push(`referenced source missing on disk: /images/${source} (${w.filePath})`);
      }
    }
  }

  // 2. Ninguna referencia mapea al mismo objetivo
  const targetOwner = new Map();
  for (const w of plan) {
    const entries = [
      ...(w.coverTarget ? [{ source: w.coverSource, target: w.coverTarget, kind: "cover" }] : []),
      ...w.bodySourceOrder.map((source) => ({
        source,
        target: w.bodyTargetBySource.get(source),
        kind: "body",
      })),
    ];
    for (const { source, target, kind } of entries) {
      const owner = `${w.filePath} (${kind} ${source})`;
      if (targetOwner.has(target)) {
        checks[1].errors.push(
          `two references map to the same target ${target}: ${targetOwner.get(target)} and ${owner}`
        );
      } else {
        targetOwner.set(target, owner);
      }
    }
  }

  // 3. El cover no puede estar también referenciado en el cuerpo
  for (const w of plan) {
    if (w.coverSource && w.bodyTargetBySource.has(w.coverSource)) {
      checks[2].errors.push(`cover is also referenced in the body: ${w.coverSource} (${w.filePath})`);
    }
  }

  // 4. Toda referencia empieza por /images/
  for (const w of plan) {
    const refs = [w.coverRef, ...w.bodyOccurrences.map((o) => o.ref)].filter(Boolean);
    for (const ref of refs) {
      if (!ref.startsWith("/images/")) {
        checks[3].errors.push(`reference does not start with /images/: ${ref} (${w.filePath})`);
      }
    }
  }

  // 5. Los conteos medidos se mantienen: 713 + 2 + 73 = 788
  const referencedSources = new Set();
  for (const w of plan) {
    for (const source of w.bodySourceOrder) referencedSources.add(source);
    if (w.coverSource) referencedSources.add(w.coverSource);
  }
  const uiPresent = UI_ASSETS.filter((f) => imageFiles.has(f));
  const orphans = [...imageFiles].filter((f) => !referencedSources.has(f) && !UI_ASSETS.includes(f));
  const counts = {
    referenced: referencedSources.size,
    ui: uiPresent.length,
    archived: orphans.length,
    total: imageFiles.size,
  };
  for (const key of Object.keys(EXPECTED)) {
    if (counts[key] !== EXPECTED[key]) {
      checks[4].errors.push(`count mismatch for ${key}: expected ${EXPECTED[key]}, found ${counts[key]}`);
    }
  }
  if (counts.referenced + counts.ui + counts.archived !== counts.total) {
    checks[4].errors.push(
      `partition mismatch: ${counts.referenced} + ${counts.ui} + ${counts.archived} != ${counts.total} files present`
    );
  }

  return { checks, counts, orphans };
}

// ---------------------------------------------------------------------------
// Plan de impresión
// ---------------------------------------------------------------------------

function printPlan(plan, counts, orphans) {
  console.log("=== migrate-images plan ===\n");
  for (const w of plan) {
    console.log(`${w.filePath}`);
    console.log(`  sources: ${w.bodySourceOrder.length + (w.coverSource ? 1 : 0)}`);
    if (w.coverSource) {
      console.log(`  /images/${w.coverSource}  ->  ${w.coverTarget}   (cover)`);
    }
    for (const source of w.bodySourceOrder) {
      console.log(`  /images/${source}  ->  ${w.bodyTargetBySource.get(source)}`);
    }
    console.log("");
  }

  console.log("UI asset moves:");
  for (const f of UI_ASSETS) {
    console.log(`  /images/${f}  ->  /ui/${f}`);
  }
  console.log(`\nArchive moves (${orphans.length} unreferenced files -> public/_archive/unreferenced/):`);
  for (const f of orphans) {
    console.log(`  /images/${f}  ->  /_archive/unreferenced/${f}`);
  }

  console.log("\nTotals:");
  console.log(`  referenced : ${counts.referenced}`);
  console.log(`  ui         : ${counts.ui}`);
  console.log(`  archived   : ${counts.archived}`);
  console.log(`  files      : ${counts.total}`);
}

// ---------------------------------------------------------------------------
// Ejecución: mover ficheros + reescribir referencias
// ---------------------------------------------------------------------------

function rewriteWriteup(w) {
  const raw = fs.readFileSync(w.filePath, "utf8");

  // Cuerpo: conservar el alt byte a byte, sustituir solo la URL.
  // La línea `image:` del frontmatter no es imagen markdown, así que el regex
  // de cuerpo solo toca las refs `![...](...)`.
  const newRaw = raw.replace(MD_IMAGE_RE, (full, alt, ref) => {
    const target = w.bodyTargetBySource.get(sourceName(ref.trim()));
    return `![${alt}](${target})`;
  });

  // Frontmatter: actualizar la línea `image:` conservando comillas originales
  let rewritten = newRaw;
  if (w.coverTarget) {
    rewritten = newRaw.replace(
      /^(\s*image:\s*)(["']?)([^"'\n]*?)\2(\s*)$/m,
      (full, key, quote, _value, trail) => `${key}${quote}${w.coverTarget}${quote}${trail}`
    );
    if (rewritten === newRaw) {
      throw new Error(`could not rewrite frontmatter image: line in ${w.filePath}`);
    }
  }
  fs.writeFileSync(w.filePath, rewritten);
}

function execute(plan, orphans) {
  for (const w of plan) {
    const mediaDir = path.join(PUBLIC_DIR, "writeups", w.platform, w.slug, "media");
    fs.mkdirSync(mediaDir, { recursive: true });

    if (w.coverSource) {
      fs.renameSync(path.join(IMAGES_DIR, w.coverSource), path.join(mediaDir, `cover${extOf(w.coverSource)}`));
      console.log(`moved /images/${w.coverSource} -> ${w.coverTarget}`);
    }
    for (const source of w.bodySourceOrder) {
      const target = w.bodyTargetBySource.get(source);
      const destName = path.basename(target);
      fs.renameSync(path.join(IMAGES_DIR, source), path.join(mediaDir, destName));
      console.log(`moved /images/${source} -> ${target}`);
    }
    rewriteWriteup(w);
    console.log(`rewrote ${w.filePath}`);
  }

  fs.mkdirSync(UI_DIR, { recursive: true });
  for (const f of UI_ASSETS) {
    fs.renameSync(path.join(IMAGES_DIR, f), path.join(UI_DIR, f));
    console.log(`moved /images/${f} -> /ui/${f}`);
  }

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  for (const f of orphans) {
    fs.renameSync(path.join(IMAGES_DIR, f), path.join(ARCHIVE_DIR, f));
    console.log(`archived /images/${f} -> /_archive/unreferenced/${f}`);
  }

  // El vault plano queda vacío: el directorio no debe persistir
  fs.rmdirSync(IMAGES_DIR);
  console.log("removed empty public/images/");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Idempotencia: árbol ya migrado → nada que hacer
  const anyOldRefs = listWriteups().some((w) =>
    fs.readFileSync(w.filePath, "utf8").includes("/images/")
  );
  if (!fs.existsSync(IMAGES_DIR) && !anyOldRefs) {
    console.log("nothing to migrate: public/images/ is gone and no /images/ references remain");
    process.exit(0);
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error("error: public/images/ is missing but /images/ references remain: inconsistent tree");
    process.exit(1);
  }

  const plan = buildPlan();
  const { checks, counts, orphans } = validateInvariants(plan);

  printPlan(plan, counts, orphans);

  console.log("\nInvariants:");
  const failures = checks.flatMap((c) => c.errors);
  for (const check of checks) {
    console.log(`  ${check.errors.length === 0 ? "OK" : "FAIL"}  ${check.label}`);
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} invariant violation(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("\nAll invariants passed.");

  if (dryRun) {
    console.log("\nDry run: no files moved, no references rewritten.");
    process.exit(0);
  }

  execute(plan, orphans);
  console.log("\nMigration complete.");
}

main();
