import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';

// Convención objetivo de medios (post-migración):
//   public/writeups/<platform>/<slug>/media/  → cover.webp + 01.webp … NN.webp
//   public/ui/                                 → stark.webp, logo.webp (assets de código)
//   public/_archive/unreferenced/              → huérfanos (nunca se borran)
//   la bóveda plana antigua de imágenes          → ya no existe
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const WRITEUPS_DIR = path.join(PUBLIC_DIR, 'writeups');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const MEDIA_DIRNAME = 'media';

// Aguja del prefijo legado, construida sin literal: el barrido repo-wide del
// prefijo antiguo debe seguir siendo un centinela limpio (todo match nuevo es
// una regresión real, no ruido del propio test).
const LEGACY_PREFIX = ['/', 'images', '/'].join('');

// Extensiones binarias: se leen como buffer, nunca como texto de referencia
const BINARY_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.avif', '.mp4']);

interface WriteupRefs {
  file: string;
  platform: string;
  slug: string;
  /** Rutas de imágenes del cuerpo, en orden de primera aparición */
  bodyRefs: string[];
  /** Ruta de la imagen del frontmatter (clave `image:`) */
  frontmatterRef?: string;
  /** Prefijo que debe cumplir toda referencia de este writeup */
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

function collectWriteupRefs(): WriteupRefs[] {
  const writeups: WriteupRefs[] = [];
  if (!fs.existsSync(WRITEUPS_DIR)) return writeups;

  for (const platformEntry of fs.readdirSync(WRITEUPS_DIR, { withFileTypes: true })) {
    if (!platformEntry.isDirectory()) continue;
    const platformDir = path.join(WRITEUPS_DIR, platformEntry.name);

    for (const file of fs.readdirSync(platformDir)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(platformDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
      const slug = file.replace(/\.md$/, '');

      const bodyRefs: string[] = [];
      for (const match of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        bodyRefs.push(match[1].trim());
      }

      const frontmatterRef =
        typeof data.image === 'string' && data.image.trim() !== '' ? data.image.trim() : undefined;

      writeups.push({
        file: path.relative(ROOT, filePath),
        platform: platformEntry.name,
        slug,
        bodyRefs,
        frontmatterRef,
        expectedPrefix: `/writeups/${platformEntry.name}/${slug}/${MEDIA_DIRNAME}/`,
      });
    }
  }
  return writeups;
}

const writeups = collectWriteupRefs();
const allRefs = writeups.flatMap((w) => [...w.bodyRefs, ...(w.frontmatterRef ? [w.frontmatterRef] : [])]);

describe('media convention', () => {
  it('every image reference (markdown body and frontmatter image:) lives under /writeups/<platform>/<slug>/media/', () => {
    const violations: string[] = [];
    for (const writeup of writeups) {
      for (const ref of [...writeup.bodyRefs, ...(writeup.frontmatterRef ? [writeup.frontmatterRef] : [])]) {
        if (!ref.startsWith(writeup.expectedPrefix)) {
          violations.push(`${writeup.file}: ${ref} (expected prefix ${writeup.expectedPrefix})`);
        }
      }
    }
    expect(writeups.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('no file under public/writeups/ mentions the legacy flat-image vault', () => {
    const violations: string[] = [];
    for (const file of listFilesRecursive(WRITEUPS_DIR)) {
      if (!isTextFile(file)) continue;
      const raw = fs.readFileSync(file, 'utf8');
      if (raw.includes(LEGACY_PREFIX)) {
        violations.push(path.relative(ROOT, file));
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

  it('no orphans inside public/writeups/**/media/: every file is referenced', () => {
    const referenced = new Set(allRefs.map((ref) => decodeURIComponent(ref)));
    const violations: string[] = [];
    for (const file of listFilesRecursive(WRITEUPS_DIR)) {
      const dir = path.dirname(file);
      if (path.basename(dir) !== MEDIA_DIRNAME) continue;
      const relUrl = `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`;
      if (!referenced.has(relUrl)) {
        violations.push(path.relative(ROOT, file));
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
