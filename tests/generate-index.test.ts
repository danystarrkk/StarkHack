import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateIndex } from '../scripts/generate-index.js';

// Fixtures always live outside the repository, in a fresh OS temp directory.
const tempDirs: string[] = [];

function makeTempWriteupsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starkhack-generate-index-'));
  tempDirs.push(dir);
  return dir;
}

function writeWriteup(
  root: string,
  platform: string,
  filename: string,
  frontmatterLines: string[],
  body = '# Writeup body'
): string {
  const platformDir = path.join(root, platform);
  fs.mkdirSync(platformDir, { recursive: true });
  const filePath = path.join(platformDir, filename);
  const file = ['---', ...frontmatterLines, '---', '', body, ''].join('\n');
  fs.writeFileSync(filePath, file);
  return filePath;
}

// Writes a markdown file with no frontmatter block at all.
function writeRawWriteup(root: string, platform: string, filename: string, text: string): string {
  const platformDir = path.join(root, platform);
  fs.mkdirSync(platformDir, { recursive: true });
  const filePath = path.join(platformDir, filename);
  fs.writeFileSync(filePath, text);
  return filePath;
}

// --- Multi-kind sources (Phase 1: writeup | project | certificate) -----------

// A fresh temp base holding all three content roots. The roots may not exist on
// disk: generateIndex must tolerate absent roots exactly like a missing writeups
// root (no crash, no entries).
function makeTempSource(): { writeup: string; project: string; certificate: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starkhack-generate-index-'));
  tempDirs.push(base);
  return {
    writeup: path.join(base, 'writeups'),
    project: path.join(base, 'projects'),
    certificate: path.join(base, 'certificates'),
  };
}

// Flat content root (projects/certificates): <root>/*.md, no platform level.
function writeFlat(root: string, filename: string, frontmatterLines: string[], body = '# Body'): string {
  fs.mkdirSync(root, { recursive: true });
  const filePath = path.join(root, filename);
  fs.writeFileSync(filePath, ['---', ...frontmatterLines, '---', '', body, ''].join('\n'));
  return filePath;
}

// Valid taxonomy baseline for flat kinds: from the approved extension on,
// every project and certificate needs a `group` of its kind and >=1 tag of its
// kind's vocabulary. Fixtures spread these so each test breaks exactly one rule.
const projectTaxonomy = ['group: "scripts"', 'tags: ["CLI Utilities", "Recon"]'];
const certificateTaxonomy = ['group: "hack4u"', 'tags: ["Networking", "Cloud"]'];

const cliModuleUrl = new URL('../scripts/generate-index.js', import.meta.url).href;

// Runs the CLI entry point in a child process so exit codes and stderr are observable.
function runCliInChildProcess(writeupsDir: string, outputFile: string) {
  const code = [
    `import { runCli } from ${JSON.stringify(cliModuleUrl)};`,
    `runCli(${JSON.stringify(writeupsDir)}, ${JSON.stringify(outputFile)});`,
  ].join('');
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('generateIndex', () => {
  it('excludes drafts while including entries with draft false or no draft key', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'drafted.md', ['title: "Drafted"', 'date: 2026-01-01', 'draft: true']);
    writeWriteup(root, 'hackmyvm', 'published.md', ['title: "Published"', 'date: 2026-01-02', 'draft: false']);
    writeWriteup(root, 'hackmyvm', 'implicit.md', ['title: "Implicit"', 'date: 2026-01-03']);

    const slugs = generateIndex(root).map((item) => item.slug);

    expect(slugs).toHaveLength(2);
    expect(slugs).not.toContain('drafted');
    expect(slugs).toContain('published');
    expect(slugs).toContain('implicit');
  });

  it('orders writeups by date descending', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'older.md', ['title: "Older"', 'date: 2024-01-01']);
    writeWriteup(root, 'hackmyvm', 'newest.md', ['title: "Newest"', 'date: 2025-06-15']);
    writeWriteup(root, 'hackmyvm', 'oldest.md', ['title: "Oldest"', 'date: 2023-12-31']);

    const slugs = generateIndex(root).map((item) => item.slug);

    expect(slugs).toEqual(['newest', 'older', 'oldest']);
  });

  it('derives platform from the directory name, slug from the filename, and a /writeups path', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'machine-one.md', ['title: "Machine One"', 'date: 2026-01-01']);

    const index = generateIndex(root);

    expect(index).toHaveLength(1);
    expect(index[0].platform).toBe('hackmyvm');
    expect(index[0].slug).toBe('machine-one');
    expect(index[0].path).toBe('/writeups/hackmyvm/machine-one.md');
    expect(index[0].title).toBe('Machine One');
  });

  it('ignores non-directory entries in the writeups directory', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'real.md', ['title: "Real"', 'date: 2026-01-01']);
    fs.writeFileSync(path.join(root, 'README.md'), '# Not a platform\n');
    fs.writeFileSync(path.join(root, 'stray.txt'), 'noise\n');

    const index = generateIndex(root);

    expect(index).toHaveLength(1);
    expect(index[0].slug).toBe('real');
  });

  it('returns an empty index for a non-existent directory', () => {
    const root = makeTempWriteupsDir();
    const missing = path.join(root, 'does-not-exist');

    expect(generateIndex(missing)).toEqual([]);
  });

  it('returns an empty index for an empty writeups directory', () => {
    const root = makeTempWriteupsDir();

    expect(generateIndex(root)).toEqual([]);
  });

  it('throws with the file path when a writeup has no frontmatter', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeRawWriteup(root, 'hackmyvm', 'bare.md', '# Just a body, no frontmatter\n');

    expect(() => generateIndex(root)).toThrow(filePath);
  });

  it('throws with the file path when the frontmatter YAML is invalid', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'invalid.md', ['title: "Broken"', 'tags: [unclosed']);

    expect(() => generateIndex(root)).toThrow(filePath);
  });

  it('rejects a non-draft writeup missing title while skipping a draft missing title', () => {
    const root = makeTempWriteupsDir();
    // The draft sorts first: it must be skipped before validation, not rejected.
    const draftPath = writeWriteup(root, 'hackmyvm', 'a-draft.md', ['draft: true']);
    const livePath = writeWriteup(root, 'hackmyvm', 'b-live.md', ['date: 2026-01-02']);

    let thrown: unknown;
    try {
      generateIndex(root);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain(livePath);
    expect(message).toContain('title');
    expect(message).not.toContain(draftPath);

    // A draft missing every field is still just skipped.
    const draftOnlyRoot = makeTempWriteupsDir();
    writeWriteup(draftOnlyRoot, 'hackmyvm', 'draft-only.md', ['draft: true']);
    expect(generateIndex(draftOnlyRoot)).toEqual([]);
  });

  it('names every missing required field in the error message', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'nofields.md', ['description: "No title, no date"']);

    let message = '';
    try {
      generateIndex(root);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('title');
    expect(message).toContain('date');
  });

  it('treats empty required fields as missing', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'empty-title.md', ['title: ""', 'date: 2026-01-01']);

    let message = '';
    try {
      generateIndex(root);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('title');
    expect(message).not.toContain('date');
  });

  it('rejects an array title even though it is present (R3-002)', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'array-title.md', [
      'title: ["not", "a", "string"]',
      'date: 2026-09-15',
    ]);

    expect(() => generateIndex(root)).toThrow(filePath);
  });

  it('rejects a numeric title even though it is present (R3-002)', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'numeric-title.md', [
      'title: 123',
      'date: 2026-09-15',
    ]);

    expect(() => generateIndex(root)).toThrow(filePath);
  });
});

describe('generateIndex multi-kind sources', () => {
  it('throws with the file path when a project lacks image', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.project, 'no-image.md', ['title: "No Image"', 'date: 2026-01-01', ...projectTaxonomy]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('image');
  });

  it('throws with the file path when a certificate lacks order', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'no-order.md', [
      'title: "No Order"',
      'image: "/certificates/no-order/media/cover.webp"',
      'description: "Missing order"',
      ...certificateTaxonomy,
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('order');
  });

  it('rejects a string certificate order ("3")', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'string-order.md', [
      'title: "String Order"',
      'order: "3"',
      'image: "/x.webp"',
      'description: "d"',
      ...certificateTaxonomy,
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('order');
  });

  it('rejects a fractional certificate order (2.5)', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'fractional-order.md', [
      'title: "Fractional"',
      'order: 2.5',
      'image: "/x.webp"',
      'description: "d"',
      ...certificateTaxonomy,
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('order');
  });

  it('rejects two certificates that share an order', () => {
    const source = makeTempSource();
    const first = writeFlat(source.certificate, 'aaa-first.md', [
      'title: "First"',
      'order: 7',
      'image: "/a.webp"',
      'description: "a"',
      ...certificateTaxonomy,
    ]);
    const second = writeFlat(source.certificate, 'bbb-second.md', [
      'title: "Second"',
      'order: 7',
      'image: "/b.webp"',
      'description: "b"',
      ...certificateTaxonomy,
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    // The error is a hard failure naming both the offending file and the file
    // that already owns the order (whichever the scan saw first).
    expect(message).toContain(first);
    expect(message).toContain(second);
    expect(message).toContain('7');
  });

  it('throws with the file path when a writeup lacks title', () => {
    const source = makeTempSource();
    const filePath = writeWriteup(source.writeup, 'hackmyvm', 'no-title.md', ['date: 2026-01-01']);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('title');
  });

  it('throws with the file path when a flat-root markdown file has no frontmatter', () => {
    const source = makeTempSource();
    fs.mkdirSync(source.project, { recursive: true });
    const filePath = path.join(source.project, 'bare.md');
    fs.writeFileSync(filePath, '# Just a body, no frontmatter\n');

    expect(() => generateIndex(source)).toThrow(filePath);
  });

  it("tags writeup entries with kind: 'writeup' and keeps today's shape", () => {
    const source = makeTempSource();
    writeWriteup(source.writeup, 'hackmyvm', 'machine-one.md', ['title: "Machine One"', 'date: 2026-01-01']);

    const index = generateIndex(source);

    expect(index).toHaveLength(1);
    expect(index[0]).toEqual({
      title: 'Machine One',
      date: '2026-01-01',
      kind: 'writeup',
      platform: 'hackmyvm',
      slug: 'machine-one',
      path: '/writeups/hackmyvm/machine-one.md',
    });
  });

  it('builds project entries with kind, no platform key, and a /projects path', () => {
    const source = makeTempSource();
    writeFlat(source.project, 'portfolio.md', [
      'title: "Portfolio"',
      'date: 2026-02-02',
      'image: "/projects/portfolio/media/cover.webp"',
      ...projectTaxonomy,
    ]);

    const index = generateIndex(source);

    expect(index).toHaveLength(1);
    expect(index[0].kind).toBe('project');
    expect(index[0].slug).toBe('portfolio');
    expect(index[0].path).toBe('/projects/portfolio.md');
    expect(index[0]).not.toHaveProperty('platform');
  });

  it('builds certificate entries with kind, integer order, and a /certificates path', () => {
    const source = makeTempSource();
    writeFlat(source.certificate, 'oscp.md', [
      'title: "OSCP"',
      'order: 4',
      'image: "/certificates/oscp/media/cover.webp"',
      'description: "Offensive Security Certified Professional"',
      ...certificateTaxonomy,
    ]);

    const index = generateIndex(source);

    expect(index).toHaveLength(1);
    expect(index[0].kind).toBe('certificate');
    expect(index[0].slug).toBe('oscp');
    expect(index[0].path).toBe('/certificates/oscp.md');
    expect(index[0].order).toBe(4);
    expect(index[0]).not.toHaveProperty('platform');
  });

  it('tolerates absent project and certificate roots', () => {
    const source = makeTempSource();
    writeWriteup(source.writeup, 'hackmyvm', 'one.md', ['title: "One"', 'date: 2026-01-01']);

    expect(generateIndex(source)).toHaveLength(1);
    expect(generateIndex({})).toEqual([]);
  });

  it('sorts dated entries newest first, undated entries last, certificates by ascending order', () => {
    const source = makeTempSource();
    writeWriteup(source.writeup, 'hackmyvm', 'old.md', ['title: "Old"', 'date: 2024-01-01']);
    writeWriteup(source.writeup, 'hackmyvm', 'new.md', ['title: "New"', 'date: 2025-01-01']);
    writeFlat(source.project, 'dated-project.md', ['title: "Dated"', 'date: 2026-06-06', 'image: "/p.webp"', ...projectTaxonomy]);
    // Certificates are the only kind that may omit `date`.
    writeFlat(source.certificate, 'cert-3.md', ['title: "Three"', 'order: 3', 'image: "/3.webp"', 'description: "d3"', ...certificateTaxonomy]);
    writeFlat(source.certificate, 'cert-1.md', ['title: "One"', 'order: 1', 'image: "/1.webp"', 'description: "d1"', ...certificateTaxonomy]);

    const slugs = generateIndex(source).map((item) => item.slug);

    // Documented ordering rule: (1) dated entries first, newest first;
    // (2) entries without a date sort last; (3) certificates use `order` as
    // their stable secondary key, so the undated tail reads cert-1, cert-3.
    expect(slugs).toEqual(['dated-project', 'new', 'old', 'cert-1', 'cert-3']);
  });

  it('sorts dated certificates among the dated entries by date, not by order', () => {
    const source = makeTempSource();
    writeFlat(source.certificate, 'cert-a.md', [
      'title: "A"',
      'order: 1',
      'date: 2026-01-01',
      'image: "/a.webp"',
      'description: "a"',
      ...certificateTaxonomy,
    ]);
    writeFlat(source.certificate, 'cert-b.md', [
      'title: "B"',
      'order: 2',
      'date: 2025-01-01',
      'image: "/b.webp"',
      'description: "b"',
      ...certificateTaxonomy,
    ]);

    const slugs = generateIndex(source).map((item) => item.slug);

    expect(slugs).toEqual(['cert-a', 'cert-b']);
  });
});

describe('generateIndex project/certificate group and tag validation', () => {
  it('throws with the file path when a project has no group', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.project, 'no-group.md', [
      'title: "No Group"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'tags: ["CLI Utilities"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('group');
  });

  it('throws naming the offending group value and the valid options (project)', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.project, 'bad-group.md', [
      'title: "Bad Group"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'group: "otro"',
      'tags: ["CLI Utilities"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('otro');
    expect(message).toContain('scripts');
    expect(message).toContain('automatizaciones');
    expect(message).toContain('herramientas');
  });

  it('throws when a project has no tags or an empty tags list', () => {
    const source = makeTempSource();
    const noTagsPath = writeFlat(source.project, 'no-tags.md', [
      'title: "No Tags"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'group: "scripts"',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(noTagsPath);

    const emptyTagsRoot = makeTempSource();
    const emptyTagsPath = writeFlat(emptyTagsRoot.project, 'empty-tags.md', [
      'title: "Empty Tags"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'group: "scripts"',
      'tags: []',
    ]);

    let emptyMessage = '';
    try {
      generateIndex(emptyTagsRoot);
    } catch (error) {
      emptyMessage = (error as Error).message;
    }

    expect(emptyMessage).toContain(emptyTagsPath);
  });

  it('throws naming the file and the offending tag when a project tag is outside PROJECT_TAGS', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.project, 'bad-tag.md', [
      'title: "Bad Tag"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'group: "scripts"',
      'tags: ["Not A Project Tag"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('Not A Project Tag');
  });

  it('throws with the file path when a certificate has no group', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'no-group.md', [
      'title: "No Group"',
      'order: 1',
      'image: "/x.webp"',
      'description: "d"',
      'tags: ["Networking"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('group');
  });

  it('throws naming the offending group value and the valid options (certificate)', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'bad-group.md', [
      'title: "Bad Group"',
      'order: 1',
      'image: "/x.webp"',
      'description: "d"',
      'group: "otro"',
      'tags: ["Networking"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('otro');
    expect(message).toContain('universidad');
    expect(message).toContain('hack4u');
    expect(message).toContain('cisco');
  });

  it('throws when a certificate has no tags or an empty tags list', () => {
    const source = makeTempSource();
    const noTagsPath = writeFlat(source.certificate, 'no-tags.md', [
      'title: "No Tags"',
      'order: 1',
      'image: "/x.webp"',
      'description: "d"',
      'group: "hack4u"',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(noTagsPath);

    const emptyTagsRoot = makeTempSource();
    const emptyTagsPath = writeFlat(emptyTagsRoot.certificate, 'empty-tags.md', [
      'title: "Empty Tags"',
      'order: 1',
      'image: "/x.webp"',
      'description: "d"',
      'group: "hack4u"',
      'tags: []',
    ]);

    let emptyMessage = '';
    try {
      generateIndex(emptyTagsRoot);
    } catch (error) {
      emptyMessage = (error as Error).message;
    }

    expect(emptyMessage).toContain(emptyTagsPath);
  });

  it('throws naming the file and the offending tag when a certificate tag is outside CERTIFICATE_TAGS', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.certificate, 'bad-tag.md', [
      'title: "Bad Tag"',
      'order: 1',
      'image: "/x.webp"',
      'description: "d"',
      'group: "hack4u"',
      'tags: ["Not A Certificate Tag"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('Not A Certificate Tag');
  });

  it('rejects a project tag from the certificate vocabulary (vocabularies are per-kind)', () => {
    const source = makeTempSource();
    const filePath = writeFlat(source.project, 'cert-tag.md', [
      'title: "Cert Tag"',
      'date: 2026-01-01',
      'image: "/x.webp"',
      'group: "scripts"',
      'tags: ["Incident Response"]',
    ]);

    let message = '';
    try {
      generateIndex(source);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(filePath);
    expect(message).toContain('Incident Response');
  });

  it('indexes a fully valid project carrying its group and tags', () => {
    const source = makeTempSource();
    writeFlat(source.project, 'recon-tool.md', [
      'title: "Recon Tool"',
      'date: 2026-03-03',
      'image: "/projects/recon-tool/media/cover.webp"',
      'group: "herramientas"',
      'tags:',
      '  - Recon',
      '  - OSINT',
    ]);

    const index = generateIndex(source);

    expect(index).toHaveLength(1);
    expect(index[0].kind).toBe('project');
    expect(index[0].group).toBe('herramientas');
    expect(index[0].tags).toEqual(['Recon', 'OSINT']);
    expect(index[0].slug).toBe('recon-tool');
  });

  it('indexes a fully valid certificate carrying its group and tags', () => {
    const source = makeTempSource();
    writeFlat(source.certificate, 'oscp.md', [
      'title: "OSCP"',
      'order: 1',
      'image: "/certificates/oscp/media/cover.webp"',
      'description: "Offensive Security"',
      'group: "hack4u"',
      'tags:',
      '  - Web Security',
      '  - Systems',
    ]);

    const index = generateIndex(source);

    expect(index).toHaveLength(1);
    expect(index[0].kind).toBe('certificate');
    expect(index[0].group).toBe('hack4u');
    expect(index[0].tags).toEqual(['Web Security', 'Systems']);
    expect(index[0].slug).toBe('oscp');
  });

  it('skips drafts before validating group and tags (a draft needs no metadata)', () => {
    const source = makeTempSource();
    writeFlat(source.project, 'a-draft-project.md', ['draft: true', 'group: "otro"', 'tags: []']);
    writeFlat(source.certificate, 'b-draft-certificate.md', ['draft: true']);

    expect(generateIndex(source)).toEqual([]);
  });
});

describe('generateIndex byte-stable ordering (R3-byte-stability-readdir)', () => {
  it('orders equal-dated flat entries by filename even when readdir returns them scrambled', () => {
    const source = makeTempSource();
    // Same date for both files: nothing but the file-name tiebreak may decide.
    writeFlat(source.project, 'z.md', ['title: "Zed"', 'date: 2026-01-01', 'image: "/z.webp"', ...projectTaxonomy]);
    writeFlat(source.project, 'a.md', ['title: "Ay"', 'date: 2026-01-01', 'image: "/a.webp"', ...projectTaxonomy]);

    // POSIX does not guarantee readdirSync order: force the scrambled listing
    // ['z.md', 'a.md'] so the output must not inherit it.
    const originalReaddirSync = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation(
      ((dir: fs.PathLike): string[] => {
        if (String(dir) === source.project) return ['z.md', 'a.md'];
        return originalReaddirSync(dir) as unknown as string[];
      }) as unknown as typeof fs.readdirSync,
    );

    const slugs = generateIndex(source).map((item) => item.slug);

    expect(slugs).toEqual(['a', 'z']);
  });

  it('orders equal-dated platformed entries by filename even when readdir returns them scrambled', () => {
    const source = makeTempSource();
    writeWriteup(source.writeup, 'hackmyvm', 'z.md', ['title: "Zed"', 'date: 2026-01-01']);
    writeWriteup(source.writeup, 'hackmyvm', 'a.md', ['title: "Ay"', 'date: 2026-01-01']);

    const platformDir = path.join(source.writeup, 'hackmyvm');
    const originalReaddirSync = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation(
      ((dir: fs.PathLike): string[] => {
        if (String(dir) === platformDir) return ['z.md', 'a.md'];
        return originalReaddirSync(dir) as unknown as string[];
      }) as unknown as typeof fs.readdirSync,
    );

    const slugs = generateIndex(source).map((item) => item.slug);

    expect(slugs).toEqual(['a', 'z']);
  });
});

describe('generate-index CLI', () => {
  it('writes the index and prints the generated count', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'one.md', ['title: "One"', 'date: 2026-01-01']);
    writeWriteup(root, 'hackmyvm', 'two.md', ['title: "Two"', 'date: 2026-01-02']);
    const outputFile = path.join(root, 'index.json');

    const result = runCliInChildProcess(root, outputFile);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('Generated index.json with 2 writeups.');
    expect(JSON.parse(fs.readFileSync(outputFile, 'utf8'))).toHaveLength(2);
  });

  it('prints a one-line error to stderr and exits 1 on invalid metadata', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'broken.md', ['date: 2026-01-01']);
    const outputFile = path.join(root, 'index.json');

    const result = runCliInChildProcess(root, outputFile);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(filePath);
    // Clean failure: exactly one stderr line, no stack trace, no half-written index.
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(fs.existsSync(outputFile)).toBe(false);
  });
});
