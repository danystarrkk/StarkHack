// Integration contract for scripts/edit-content.js (T2): the interactive CLI
// that drives the pure planner of lib/content-edit.js (B1/T1). The runner must
// stay honest about the binding CLI contract (odd/tasks/edit-content.md):
//
//   node scripts/edit-content.js <writeup|project|certificate> <slug> [--platform <p>] [--dry-run]
//
//   - parseArgs accepts exactly the three command shapes (--platform only for
//     writeup, --dry-run everywhere) and fails every other shape with the
//     add-content message style;
//   - formatInventory / formatPlan are PURE and deterministic: no timestamps,
//     no randomness — two calls on the same input render the same bytes;
//   - formatPlan renders the identity before/after, the file operations, the
//     image mapping (cover flagged `(cover)`), the resulting frontmatter and
//     every plan problem VERBATIM;
//   - the module exports the three helpers and guards main() with
//     import.meta.url (the scripts/add-content.js pattern);
//   - a non-TTY run NEVER hangs: it prints the inventory and exits 1 with a
//     clear "interactive TTY required" message.
import { readFileSync } from 'node:fs';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatInventory, formatPlan, parseArgs } from '../scripts/edit-content.js';
// Namespace import so NEW seam exports fail as named test failures (visible
// RED) instead of a module link error while they do not exist yet.
import * as editContentCli from '../scripts/edit-content.js';
import { describeEditable, planContentEdit } from '../lib/content-edit.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'edit-content.js');

// Raw markdown builder: YAML lines + body after the frontmatter block.
const doc = (yaml: string[], body = ''): string => `---\n${yaml.join('\n')}\n---\n${body}`;

// ---------------------------------------------------------------------------
// parseArgs: the three command shapes and every failure mode
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses a writeup command with --platform and --dry-run', () => {
    expect(parseArgs(['writeup', 'wave', '--platform', 'hackmyvm', '--dry-run'])).toEqual({
      kind: 'writeup',
      slug: 'wave',
      platform: 'hackmyvm',
      dryRun: true,
    });
  });

  it('parses a project command with just kind and slug', () => {
    expect(parseArgs(['project', 'autorecon-ng'])).toEqual({
      kind: 'project',
      slug: 'autorecon-ng',
      dryRun: false,
    });
  });

  it('parses a certificate command with --dry-run', () => {
    expect(parseArgs(['certificate', 'certificado', '--dry-run'])).toEqual({
      kind: 'certificate',
      slug: 'certificado',
      dryRun: true,
    });
  });

  it('rejects an unknown content kind', () => {
    expect(() => parseArgs(['write-ups', 'wave'])).toThrow(/unknown content kind/);
    expect(() => parseArgs(['write-ups', 'wave'])).toThrow(/expected one of/);
  });

  it('rejects a missing or empty slug', () => {
    expect(() => parseArgs([])).toThrow(/missing content kind/);
    expect(() => parseArgs(['writeup'])).toThrow(/missing <slug>/);
    expect(() => parseArgs(['project'])).toThrow(/missing <slug>/);
    expect(() => parseArgs(['certificate'])).toThrow(/missing <slug>/);
    expect(() => parseArgs(['certificate', ''])).toThrow(/missing <slug>/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseArgs(['certificate', 'certificado', '--wtf', 'x'])).toThrow(/unknown option/);
  });

  it('rejects --platform for flat kinds: only writeups are platformed', () => {
    expect(() => parseArgs(['project', 'app', '--platform', 'hackmyvm'])).toThrow(
      /--platform is not valid for project/,
    );
    expect(() => parseArgs(['certificate', 'certificado', '--platform', 'hackmyvm'])).toThrow(
      /--platform is not valid for certificate/,
    );
  });

  it('rejects a flag without its value', () => {
    expect(() => parseArgs(['writeup', 'wave', '--platform'])).toThrow(/--platform requires a value/);
    expect(() => parseArgs(['writeup', 'wave', '--platform', '--dry-run'])).toThrow(/--platform requires a value/);
  });

  it('rejects extra positional arguments', () => {
    expect(() => parseArgs(['certificate', 'certificado', 'extra'])).toThrow(/unexpected argument/);
  });
});

// ---------------------------------------------------------------------------
// formatInventory: deterministic listing of the editable aspects
// ---------------------------------------------------------------------------

describe('formatInventory', () => {
  const certInventory = () =>
    describeEditable('certificate', {
      frontmatter: {
        title: 'eJPT',
        order: 2,
        image: '/certificates/ejpt/media/cover.webp',
        description: 'Certificación eJPT.',
        group: 'hack4u',
        tags: ['Networking'],
      },
      media: ['01.webp', 'cover.webp'],
      bodyHasImages: true,
      slug: 'ejpt',
    });
  const certIdentity = () => ({ kind: 'certificate', slug: 'ejpt', file: 'public/certificates/ejpt.md' });

  it('lists every aspect with its label and current value, plus the identity', () => {
    const out = formatInventory(certInventory(), certIdentity());

    expect(out).toContain('=== edit-content inventory ===');
    expect(out).toContain('certificate "ejpt"');
    expect(out).toContain('public/certificates/ejpt.md');
    expect(out).toContain('Title');
    expect(out).toContain('eJPT');
    expect(out).toContain('Order');
    expect(out).toContain('Group');
    expect(out).toContain('hack4u');
    expect(out).toContain('Tags');
    expect(out).toContain('Networking');
    expect(out).toContain('Cover image');
    expect(out).toContain('cover.webp');
    expect(out).toContain('Evidence images');
    expect(out).toContain('01.webp');
    expect(out).toContain('Rename slug');
  });

  it('marks derived and read-only aspects', () => {
    const writeup = describeEditable('writeup', {
      frontmatter: { title: 'Wave', level: 'Medium' },
      media: ['cover.webp'],
      bodyHasImages: false,
      slug: 'wave',
      platform: 'hackmyvm',
    });
    const out = formatInventory(writeup, { kind: 'writeup', slug: 'wave', platform: 'hackmyvm' });

    expect(out).toContain('writeup "wave"');
    expect(out).toContain('hackmyvm');
    expect(out).toContain('Platform');
    expect(out).toContain('(derived)');
    // The writeup cover derives from `level` — display-only, never edited.
    expect(out).toContain('Cover image');
    expect(out).toContain('(read-only)');
  });

  it('renders a Date value as a date, never as a timestamp', () => {
    const project = describeEditable('project', {
      frontmatter: { title: 'App', date: new Date('2026-06-02T00:00:00.000Z') },
      media: [],
      bodyHasImages: false,
      slug: 'app',
    });
    const out = formatInventory(project, { kind: 'project', slug: 'app' });

    expect(out).toContain('2026-06-02');
    expect(out).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('is deterministic and contains no timestamps', () => {
    const first = formatInventory(certInventory(), certIdentity());
    const second = formatInventory(certInventory(), certIdentity());

    expect(first).toBe(second);
    expect(first).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// formatPlan: identity before/after, file ops, image mapping, verbatim problems
// ---------------------------------------------------------------------------

describe('formatPlan', () => {
  const CERT_YAML = [
    'title: eJPT',
    'order: 2',
    'image: "/certificates/ejpt/media/cover.webp"',
    'description: "Certificación eJPT."',
    'group: hack4u',
    'tags:',
    '  - Networking',
  ];
  const CERT_BODY = 'Evidencia:\n\n![img1](/certificates/ejpt/media/01.webp)';

  // Rename + evidence add + cover replace: every renderer section gets rows.
  const fullPlan = () =>
    planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, CERT_BODY),
      media: ['01.webp', 'cover.webp'],
      changes: {
        images: { add: ['scan2.png'] },
        cover: { source: 'new-cover.jpg' },
        rename: { slug: 'ejpt v2' }, // normalized by the planner to 'ejpt-v2'
      },
      siblings: { certificateOrders: [{ order: 2, slug: 'ejpt' }, { order: 5, slug: 'other' }] },
    });

  const identity = { kind: 'certificate', slug: 'ejpt' } as const;

  it('renders the identity before/after, the file operations and the image mapping with the (cover) marker', () => {
    const plan = fullPlan();
    expect(plan.problems).toEqual([]);
    const out = formatPlan(plan, identity);

    expect(out).toContain('=== edit-content plan ===');
    // Identity before/after (the rename is the dangerous part: always visible).
    expect(out).toContain('identity before:');
    expect(out).toContain('certificate "ejpt"');
    expect(out).toContain('identity after:');
    expect(out).toContain('certificate "ejpt-v2"');
    // File operations: the .md and the media/ dir travel TOGETHER on rename.
    expect(out).toContain('public/certificates/ejpt.md -> public/certificates/ejpt-v2.md');
    expect(out).toContain('public/certificates/ejpt/media -> public/certificates/ejpt-v2/media');
    expect(out).toContain('public/certificates/ejpt-v2.md');
    // Image mapping rows, cover flagged exactly like add-content's renderer.
    expect(out).toContain('scan2.png -> public/certificates/ejpt-v2/media/02.webp');
    expect(out).toContain('new-cover.jpg -> public/certificates/ejpt-v2/media/cover.webp   (cover)');
    // Resulting frontmatter (image: refreshed to the final sitePath).
    expect(out).toContain('/certificates/ejpt-v2/media/cover.webp');
    expect(out).toContain('problems: none');
  });

  it('renders every problem verbatim under a problems section', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'broken',
      markdown: doc(
        ['title: Broken', 'order: 2', 'group: nope', 'tags:', '  - NotATag'],
        '![img1](/certificates/broken/media/01.webp)',
      ),
      media: [],
      siblings: {},
    });
    expect(plan.problems.length).toBeGreaterThan(0);

    const out = formatPlan(plan, { kind: 'certificate', slug: 'broken' });
    expect(out).toContain(`problems (${plan.problems.length}):`);
    for (const problem of plan.problems) {
      expect(out).toContain(problem);
    }
  });

  it('renders empty file ops and image mapping explicitly and is byte-deterministic', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, CERT_BODY),
      media: ['01.webp', 'cover.webp'],
      changes: {},
    });
    expect(plan.fileOps).toEqual({ write: [], delete: [], move: [] });

    const first = formatPlan(plan, identity);
    const second = formatPlan(plan, identity);

    expect(first).toContain('(none)');
    expect(first).toContain('(no images)');
    expect(first).toBe(second);
    expect(first).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// certificate-hires B4: the edit apply loop maps the plan's `convert` hint to
// magick args exactly like add-content (`-resize <width>x`, then `-quality <q>`,
// before the target; no hint ⇒ NO extra args) and the plan output names BOTH
// regenerated certificate artifacts ((cover) + (hires) markers)
// ---------------------------------------------------------------------------

describe('convertImagePlan — magick honors the convert hint (certificate-hires B4)', () => {
  const CERT_YAML = [
    'title: eJPT',
    'order: 2',
    'image: "/certificates/ejpt/media/cover.webp"',
    'description: Certificación eJPT.',
    'group: hack4u',
    'tags:',
    '  - Networking',
  ];
  const APP_YAML = [
    'title: AutoRecon-NG',
    'date: "2026-09-15"',
    'image: "/projects/autorecon-ng/media/cover.webp"',
    'group: scripts',
    'tags:',
    '  - Recon',
  ];

  // Spawn recorder: captures every (command, argv) the runner would spawn.
  const recorder = (calls: string[][]) =>
    ((command: string, args: string[] = []) => {
      calls.push([command, ...args]);
      return { status: 0, stderr: '' };
    }) as never;

  it('spawns magick for the regenerated cover with -resize 1600x -quality 82 and for hires with -quality 95', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes: { cover: { source: 'scan.png' } },
    });
    const calls: string[][] = [];

    const failure = editContentCli.convertImagePlan(plan, recorder(calls));

    expect(failure).toBeNull();
    expect(calls).toEqual([
      [
        'magick',
        path.join(process.cwd(), 'scan.png'),
        '-resize',
        '1600x',
        '-quality',
        '82',
        path.resolve(REPO_ROOT, 'public/certificates/ejpt/media/cover.webp'),
      ],
      [
        'magick',
        path.join(process.cwd(), 'scan.png'),
        '-quality',
        '95',
        path.resolve(REPO_ROOT, 'public/certificates/ejpt/media/hires.webp'),
      ],
    ]);
  });

  it('spawns magick for a project cover with NO extra args (byte-identical invocation)', () => {
    const plan = planContentEdit({
      kind: 'project',
      slug: 'autorecon-ng',
      markdown: doc(APP_YAML, ''),
      media: ['cover.webp'],
      changes: { cover: { source: 'shot.png' } },
    });
    const calls: string[][] = [];

    const failure = editContentCli.convertImagePlan(plan, recorder(calls));

    expect(failure).toBeNull();
    expect(calls).toEqual([
      [
        'magick',
        path.join(process.cwd(), 'shot.png'),
        path.resolve(REPO_ROOT, 'public/projects/autorecon-ng/media/cover.webp'),
      ],
    ]);
  });

  it('prints the hires row marked (hires) next to the (cover) row in the edit plan', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes: { cover: { source: 'scan.png' } },
    });
    const out = formatPlan(plan, { kind: 'certificate', slug: 'ejpt' });

    expect(out).toContain('scan.png -> public/certificates/ejpt/media/cover.webp   (cover)');
    expect(out).toContain('scan.png -> public/certificates/ejpt/media/hires.webp   (hires)');
  });
});

// ---------------------------------------------------------------------------
// Source contract: exported helpers + main() guarded by import.meta.url
// ---------------------------------------------------------------------------

describe('source contract', () => {
  it('exports the three pure helpers and guards main() with import.meta.url', () => {
    const source = readFileSync(CLI_PATH, 'utf8');

    expect(source).toMatch(/export function parseArgs\(/);
    expect(source).toMatch(/export function formatInventory\(/);
    expect(source).toMatch(/export function formatPlan\(/);
    // main() only runs when the file is executed as a script (add-content guard).
    expect(source).toMatch(
      /if \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// End-to-end non-TTY: never hangs, exits 1 after printing usage/inventory
// ---------------------------------------------------------------------------

describe('edit-content CLI (spawned, non-TTY)', () => {
  function runCli(args: string[]) {
    // A 15s timeout turns a hypothetical hang into a visible failure instead
    // of a frozen test run.
    return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', timeout: 15000 });
  }

  it('no arguments prints the usage with the three kinds and exits 1', () => {
    const bare = runCli([]);
    expect(bare.signal).toBeNull();
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain('writeup');
    expect(bare.stderr).toContain('project');
    expect(bare.stderr).toContain('certificate');
  });

  it('a missing document fails clearly and exits 1', () => {
    const result = runCli(['certificate', 'definitely-missing-slug']);
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('definitely-missing-slug');
  });

  it('non-TTY prints the inventory and exits 1 with "interactive TTY required" (never hangs)', () => {
    const certDir = path.join(REPO_ROOT, 'public', 'certificates');
    const first = fs.existsSync(certDir)
      ? fs
          .readdirSync(certDir)
          .filter((entry) => entry.endsWith('.md'))
          .sort()[0]
      : undefined;
    if (first === undefined) return; // no published certificate to load — nothing to assert

    const slug = first.replace(/\.md$/, '');
    const result = runCli(['certificate', slug]);

    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('=== edit-content inventory ===');
    expect(result.stderr).toContain('interactive TTY required');
  });
});
