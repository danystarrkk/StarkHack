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
  /** Rutas de imagen del frontmatter (claves `image:` e `imageHires:`) */
  frontmatterRefs: string[];
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

/**
 * Referencias de imagen de UN documento (markdown crudo): las del cuerpo
 * (markdown) y las del frontmatter. Función pura para poder fijar el contrato
 * del recolector con fixtures (el árbol real todavía no tiene imageHires).
 */
function collectDocumentRefs(raw: string): { bodyRefs: string[]; frontmatterRefs: string[] } {
  const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
  const bodyRefs: string[] = [];
  for (const match of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    bodyRefs.push(match[1].trim());
  }
  const frontmatterRefs: string[] = [];
  for (const value of [data.image, data.imageHires]) {
    if (typeof value === 'string' && value.trim() !== '') {
      frontmatterRefs.push(value.trim());
    }
  }
  return { bodyRefs, frontmatterRefs };
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
      const { bodyRefs, frontmatterRefs } = collectDocumentRefs(raw);
      const slug = path.basename(abs).replace(/\.md$/, '');

      const slugDir = platform ? `${platform}/${slug}` : slug;
      docs.push({
        file: path.relative(ROOT, abs),
        kind: root.kind,
        slug,
        bodyRefs,
        frontmatterRefs,
        expectedPrefix: `${root.urlRoot}/${slugDir}/${MEDIA_DIRNAME}/`,
      });
    }
  }
  return docs;
}

const docs = collectContentRefs();
const allRefs = docs.flatMap((d) => [...d.bodyRefs, ...d.frontmatterRefs]);

describe('media convention', () => {
  it('every image reference (markdown body and frontmatter image:/imageHires:) lives under its per-kind <...>/media/ folder', () => {
    const violations: string[] = [];
    for (const doc of docs) {
      for (const ref of [...doc.bodyRefs, ...doc.frontmatterRefs]) {
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

// ---------------------------------------------------------------------------
// certificate-hires B2: the refs collector learns `imageHires:` so a
// certificate's hires.webp is referenced (never an orphan). Pure fixture
// pins — the real-tree sweeps above prove the 7 existing certificates (only
// cover.webp, no imageHires yet) are unaffected.
// ---------------------------------------------------------------------------

const CERT_HIRES_FIXTURE = [
  '---',
  'title: eJPT',
  'order: 2',
  'image: /certificates/ejpt/media/cover.webp',
  'imageHires: /certificates/ejpt/media/hires.webp',
  '---',
  'Sin referencias en el cuerpo.',
].join('\n');

describe('media convention — refs collector counts imageHires (certificate-hires B2)', () => {
  it('counts frontmatter imageHires: so the hires original is NOT an orphan', () => {
    const { bodyRefs, frontmatterRefs } = collectDocumentRefs(CERT_HIRES_FIXTURE);
    expect(bodyRefs).toEqual([]);
    expect(frontmatterRefs).toContain('/certificates/ejpt/media/cover.webp');
    expect(frontmatterRefs).toContain('/certificates/ejpt/media/hires.webp');
  });

  it('still leaves genuinely unreferenced media files orphan-flagged (no over-counting)', () => {
    const { frontmatterRefs } = collectDocumentRefs(CERT_HIRES_FIXTURE);
    // 01.webp appears in no body and no frontmatter key: the orphan sweep
    // must keep flagging it.
    expect(frontmatterRefs).not.toContain('/certificates/ejpt/media/01.webp');
    // And a certificate WITHOUT imageHires references no hires.webp either.
    const withoutHires = collectDocumentRefs(
      '---\ntitle: eJPT\nimage: /certificates/ejpt/media/cover.webp\n---\n'
    );
    expect(withoutHires.frontmatterRefs).not.toContain('/certificates/ejpt/media/hires.webp');
  });
});
