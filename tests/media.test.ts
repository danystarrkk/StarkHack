import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { KINDS } from '../lib/content-kinds.js';

// Convención objetivo de medios (post-migración):
//   public/writeups/<platform>/<slug>/media/  → cover.webp + 01.webp … NN.webp
//   public/projects/<slug>/media/             → ídem para proyectos (raíz plana)
//   public/certificates/<slug>/media/         → ídem para certificados (raíz plana)
//   public/ui/                                 → stark.webp, logo.webp (assets de código)
//   public/_archive/unreferenced/              → huérfanos (nunca se borran)
//   la bóveda plana antigua de imágenes          → ya no existe
//
// Las raíces de contenido salen del registro KINDS (lib/content-kinds.js), nunca
// hardcodeadas. Una raíz ausente (public/projects, public/certificates hoy) no
// aporta archivos ni referencias: los tests siguen pasando.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const MEDIA_DIRNAME = 'media';

const KIND_ROOTS = Object.entries(KINDS).map(([kind, spec]) => ({
  kind,
  dir: path.join(ROOT, spec.root),
  urlRoot: `/${spec.root.replace(/^public\//, '')}`,
  platformed: spec.platformed,
}));

// Aguja del prefijo legado, construida sin literal: el barrido repo-wide del
// prefijo antiguo debe seguir siendo un centinela limpio (todo match nuevo es
// una regresión real, no ruido del propio test).
const LEGACY_PREFIX = ['/', 'images', '/'].join('');

// Extensiones binarias: se leen como buffer, nunca como texto de referencia
const BINARY_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.avif', '.mp4']);

interface ContentRefs {
  file: string;
  kind: string;
  slug: string;
  /** Rutas de imágenes del cuerpo, en orden de primera aparición */
  bodyRefs: string[];
  /** Ruta de la imagen del frontmatter (clave `image:`) */
  frontmatterRef?: string;
  /** Prefijo que debe cumplir toda referencia de este documento */
  expectedPrefix: string;
}

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function isTextFile(file: string): boolean {
  return !BINARY_EXTS.has(path.extname(file).toLowerCase());
}

function collectContentRefs(): ContentRefs[] {
  const docs: ContentRefs[] = [];

  for (const root of KIND_ROOTS) {
    if (!fs.existsSync(root.dir)) continue;

    // Plataformado (<root>/<platform>/*.md) o plano (<root>/*.md), como el indexador.
    const mdFiles: { abs: string; platform?: string }[] = root.platformed
      ? fs
          .readdirSync(root.dir, { withFileTypes: true })
          .filter((platformEntry) => platformEntry.isDirectory())
          .flatMap((platformEntry) =>
            fs
              .readdirSync(path.join(root.dir, platformEntry.name))
              .filter((file) => file.endsWith('.md'))
              .map((file) => ({
                abs: path.join(root.dir, platformEntry.name, file),
                platform: platformEntry.name,
              }))
          )
      : fs
          .readdirSync(root.dir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
          .map((entry) => ({ abs: path.join(root.dir, entry.name) }));

    for (const { abs, platform } of mdFiles) {
      const raw = fs.readFileSync(abs, 'utf8');
      const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
      const slug = path.basename(abs).replace(/\.md$/, '');

      const bodyRefs: string[] = [];
      for (const match of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        bodyRefs.push(match[1].trim());
      }

      const frontmatterRef =
        typeof data.image === 'string' && data.image.trim() !== '' ? data.image.trim() : undefined;

      const slugDir = platform ? `${platform}/${slug}` : slug;
      docs.push({
        file: path.relative(ROOT, abs),
        kind: root.kind,
        slug,
        bodyRefs,
        frontmatterRef,
        expectedPrefix: `${root.urlRoot}/${slugDir}/${MEDIA_DIRNAME}/`,
      });
    }
  }
  return docs;
}

const docs = collectContentRefs();
const allRefs = docs.flatMap((d) => [...d.bodyRefs, ...(d.frontmatterRef ? [d.frontmatterRef] : [])]);

describe('media convention', () => {
  it('every image reference (markdown body and frontmatter image:) lives under its per-kind <...>/media/ folder', () => {
    const violations: string[] = [];
    for (const doc of docs) {
      for (const ref of [...doc.bodyRefs, ...(doc.frontmatterRef ? [doc.frontmatterRef] : [])]) {
        if (!ref.startsWith(doc.expectedPrefix)) {
          violations.push(`${doc.file}: ${ref} (expected prefix ${doc.expectedPrefix})`);
        }
      }
    }
    expect(docs.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('no file under the content roots mentions the legacy flat-image vault', () => {
    const violations: string[] = [];
    for (const root of KIND_ROOTS) {
      for (const file of listFilesRecursive(root.dir)) {
        if (!isTextFile(file)) continue;
        const raw = fs.readFileSync(file, 'utf8');
        if (raw.includes(LEGACY_PREFIX)) {
          violations.push(path.relative(ROOT, file));
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every referenced image resolves to an existing file under public/', () => {
    const violations: string[] = [];
    for (const ref of allRefs) {
      if (!ref.startsWith('/')) {
        violations.push(`${ref}: not an absolute site path`);
        continue;
      }
      const decoded = decodeURIComponent(ref);
      const resolved = path.resolve(PUBLIC_DIR, `.${decoded}`);
      if (!resolved.startsWith(PUBLIC_DIR + path.sep)) {
        violations.push(`${ref}: escapes public/`);
        continue;
      }
      if (!fs.existsSync(resolved)) {
        violations.push(`${ref}: missing on disk`);
      }
    }
    expect(allRefs.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('no orphans inside any content media/ folder: every file is referenced', () => {
    const referenced = new Set(allRefs.map((ref) => decodeURIComponent(ref)));
    const violations: string[] = [];
    for (const root of KIND_ROOTS) {
      for (const file of listFilesRecursive(root.dir)) {
        const dir = path.dirname(file);
        if (path.basename(dir) !== MEDIA_DIRNAME) continue;
        const relUrl = `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`;
        if (!referenced.has(relUrl)) {
          violations.push(path.relative(ROOT, file));
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the flat legacy image vault is gone', () => {
    expect(fs.existsSync(IMAGES_DIR)).toBe(false);
  });

  it('UI assets live at public/ui/stark.webp and public/ui/logo.webp', () => {
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'ui', 'stark.webp'))).toBe(true);
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'ui', 'logo.webp'))).toBe(true);
  });
});
