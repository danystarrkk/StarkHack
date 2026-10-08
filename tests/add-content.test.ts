// Integration contract for scripts/add-content.js (T2): the CLI runner over the
// pure ingestion plan of lib/content-ingest.js (T1). The runner must stay
// honest about the approved decisions (odd/tasks/content-ingestion.md):
//   - dry-run prints the deterministic plan and touches NOTHING (byte-idempotent:
//     running it twice prints the same output);
//   - every plan problem is rendered verbatim and fails the run (exit 1) both
//     with and without --dry-run; a non-TTY run must never hang waiting for
//     interactive completion — it prints the problems and exits 1;
//   - drafts are refused ("draft: true — not ingesting");
//   - the source folder is never mutated (images are converted by COPY).
//
// The testable core is exported next to a guarded main(): parseArgs,
// formatPlan and buildFrontmatterText. End-to-end checks spawn the real CLI in
// a child process (stdio pipes → non-TTY) against fixtures in a fresh OS temp
// directory; no repository file is ever used as fixture input, and the only
// repository path asserted is the dry-run target dir, which must stay ABSENT.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFrontmatterText, formatPlan, parseArgs } from '../scripts/add-content.js';
import { planContentIngestion } from '../lib/content-ingest.js';
import { parseFrontmatter } from '../lib/frontmatter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'add-content.js');

// Fixtures always live outside the repository, in a fresh OS temp directory.
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeMarkdown(dir: string, filename: string, yaml: string[], body = ''): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, `---\n${yaml.join('\n')}\n---\n${body}`);
  return filePath;
}

// Fake .png files with real bytes (PNG signature + payload): dry-run never
// converts them, so no ImageMagick is needed to exercise the planning path.
function writeFakePng(dir: string, filename: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]));
  return filePath;
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// parseArgs: the three command shapes and every failure mode
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses a writeup command with --images, --platform, --level and --dry-run', () => {
    expect(
      parseArgs(['writeup', 'wave.md', '--images', 'imgs', '--platform', 'hackmyvm', '--level', 'Medium', '--dry-run']),
    ).toEqual({
      kind: 'writeup',
      sourcePath: 'wave.md',
      images: 'imgs',
      platform: 'hackmyvm',
      level: 'Medium',
      dryRun: true,
    });
  });

  it('parses a project command with --images, --cover and --group', () => {
    expect(parseArgs(['project', 'app.md', '--images', 'imgs', '--cover', 'cover.jpg', '--group', 'scripts'])).toEqual({
      kind: 'project',
      sourcePath: 'app.md',
      images: 'imgs',
      cover: 'cover.jpg',
      group: 'scripts',
      dryRun: false,
    });
  });

  it('parses a certificate command with --image and --cover', () => {
    expect(parseArgs(['certificate', 'ejpt.md', '--image', 'scan.png', '--cover', 'scan.png'])).toEqual({
      kind: 'certificate',
      sourcePath: 'ejpt.md',
      image: 'scan.png',
      cover: 'scan.png',
      dryRun: false,
    });
  });

  it('accepts a project without --cover at parse time: the interactive prompt supplies it later', () => {
    // Human decision 3: an omitted --cover is a prompt (TTY) or a plan problem
    // ("Missing project cover …"), never a parse error.
    const args = parseArgs(['project', 'app.md', '--images', 'imgs']);
    expect(args.kind).toBe('project');
    expect(args.cover).toBeUndefined();
  });

  it('rejects an unknown content kind', () => {
    expect(() => parseArgs(['write-ups', 'x.md', '--images', 'd'])).toThrow(/unknown content kind/);
  });

  it('rejects a missing source file argument', () => {
    expect(() => parseArgs(['writeup'])).toThrow(/missing <archivo\.md>/);
    expect(() => parseArgs(['project'])).toThrow(/missing <archivo\.md>/);
    expect(() => parseArgs(['certificate'])).toThrow(/missing <archivo\.md>/);
  });

  it('rejects a missing --images for writeup and project', () => {
    expect(() => parseArgs(['writeup', 'wave.md'])).toThrow(/requires --images/);
    expect(() => parseArgs(['project', 'app.md'])).toThrow(/requires --images/);
  });

  it('rejects a missing --image for certificate', () => {
    expect(() => parseArgs(['certificate', 'ejpt.md'])).toThrow(/requires --image/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseArgs(['writeup', 'wave.md', '--images', 'd', '--cover', 'c.png'])).toThrow(
      /not valid for writeup/,
    );
    expect(() => parseArgs(['writeup', 'wave.md', '--images', 'd', '--wtf', 'x'])).toThrow(/unknown option/);
  });

  it('rejects a flag without its value', () => {
    expect(() => parseArgs(['writeup', 'wave.md', '--images'])).toThrow(/--images requires a value/);
    expect(() => parseArgs(['writeup', 'wave.md', '--images', 'd', '--level'])).toThrow(/--level requires a value/);
    expect(() => parseArgs(['writeup', 'wave.md', '--images', '--dry-run'])).toThrow(/--images requires a value/);
  });

  it('rejects a kind-inapplicable flag', () => {
    expect(() => parseArgs(['project', 'app.md', '--images', 'd', '--level', 'Easy'])).toThrow(
      /--level is not valid for project/,
    );
    expect(() => parseArgs(['certificate', 'ejpt.md', '--image', 'i.png', '--images', 'd'])).toThrow(
      /--images is not valid for certificate/,
    );
  });

  it('rejects extra positional arguments', () => {
    expect(() => parseArgs(['writeup', 'wave.md', 'extra', '--images', 'd'])).toThrow(/unexpected argument/);
  });
});

// ---------------------------------------------------------------------------
// formatPlan: deterministic dry-run rendering, problems verbatim
// ---------------------------------------------------------------------------

describe('formatPlan', () => {
  const writeupPlan = () =>
    planContentIngestion(
      'writeup',
      ['---', 'title: Wave', 'date: "2026-09-15"', 'level: Easy', 'categories:', '  - zztest', '---', ''].join('\n'),
      'Wave Fixture.md',
      ['02.jpg', '01.png'],
      {},
    );

  it('shows the source path, target dir, files to create and the image mapping rows', () => {
    const plan = writeupPlan();
    const out = formatPlan(plan, '/tmp/somewhere/Wave Fixture.md');

    expect(out).toContain('/tmp/somewhere/Wave Fixture.md');
    expect(out).toContain('public/writeups/zztest/wave-fixture');
    expect(out).toContain('public/writeups/zztest/wave-fixture/wave-fixture.md');
    expect(out).toContain('01.png -> public/writeups/zztest/wave-fixture/media/01.webp');
    expect(out).toContain('02.jpg -> public/writeups/zztest/wave-fixture/media/02.webp');
    // Writeups NEVER get a cover row (the UI derives it from `level`).
    expect(out).not.toContain('cover.webp');
  });

  it('marks the cover row for project/certificate plans', () => {
    const plan = planContentIngestion(
      'project',
      ['---', 'title: App', 'date: "2026-01-01"', 'group: scripts', 'tags:', '  - Recon', '---', ''].join('\n'),
      'app.md',
      ['01.png', 'cover.jpg'],
      { cover: 'cover.jpg' },
    );
    const out = formatPlan(plan, '/tmp/app.md');

    expect(out).toContain('cover.jpg -> public/projects/app/media/cover.webp   (cover)');
    // The cover is also planned as a numbered evidence image (on purpose).
    expect(out).toContain('cover.jpg -> public/projects/app/media/02.webp');
  });

  it('renders every problem verbatim under a problems section', () => {
    const plan = planContentIngestion('writeup', '---\nlevel: Easy\n---\n', 'broken.md', [], { platform: 'zztest' });
    expect(plan.problems.length).toBeGreaterThan(0);

    const out = formatPlan(plan, '/tmp/broken.md');
    expect(out).toContain('problems (');
    for (const problem of plan.problems) {
      expect(out).toContain(problem);
    }
    // The source path is always visible next to the problems.
    expect(out).toContain('/tmp/broken.md');
  });

  it('prints "problems: none" for a clean plan and is byte-deterministic', () => {
    const plan = writeupPlan();
    const first = formatPlan(plan, '/tmp/Wave Fixture.md');
    const second = formatPlan(plan, '/tmp/Wave Fixture.md');

    expect(first).toContain('problems: none');
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// buildFrontmatterText: round-trips through parseFrontmatter
// ---------------------------------------------------------------------------

describe('buildFrontmatterText', () => {
  it('starts and closes with --- fences', () => {
    const text = buildFrontmatterText({ title: 'Wave' });
    expect(text.startsWith('---\n')).toBe(true);
    expect(text.trimEnd().endsWith('---')).toBe(true);
  });

  it('round-trips a realistic frontmatter object through parseFrontmatter', () => {
    const data = {
      title: 'AutoRecon-NG',
      date: '2026-09-15',
      image: '/projects/autorecon-ng/media/cover.webp',
      group: 'scripts',
      tags: ['Recon', 'CLI Utilities'],
      order: 3,
      description: 'Herramienta: multiplataforma',
      draft: false,
    };

    expect(parseFrontmatter(buildFrontmatterText(data)).data).toEqual(data);
  });

  it('round-trips the normalized frontmatter planContentIngestion produces', () => {
    const plan = planContentIngestion(
      'project',
      ['---', 'title: App', 'date: "2026-01-01"', 'group: scripts', 'tags:', '  - Recon', '---', ''].join('\n'),
      'app.md',
      ['cover.jpg'],
      { cover: 'cover.jpg' },
    );

    expect(parseFrontmatter(buildFrontmatterText(plan.frontmatter)).data).toEqual(plan.frontmatter);
  });

  it('round-trips an empty object', () => {
    expect(parseFrontmatter(buildFrontmatterText({})).data).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// End-to-end dry-run over temp fixtures: exit 0, plan printed, NOTHING created
// ---------------------------------------------------------------------------

describe('add-content CLI (spawned, non-TTY)', () => {
  // Unique slug/platform so the asserted repository target dir cannot exist.
  const FIXTURE = 'add-content-e2e-fixture';
  const targetDir = path.join(REPO_ROOT, 'public', 'writeups', 'zztest', FIXTURE);

  const writeupYaml = [
    'title: Wave',
    'date: "2026-09-15"',
    'description: Writeup de la máquina Wave.',
    'categories:',
    '  - zztest',
    'level: Medium',
    'tags:',
    '  - File Upload',
  ];

  it('dry-run exits 0, prints the plan and creates nothing (byte-idempotent across runs)', () => {
    expect(fs.existsSync(targetDir)).toBe(false);
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    const mdPath = writeMarkdown(dir, `${FIXTURE}.md`, writeupYaml, 'Evidencia:\n\n[[01.png]]\n');
    writeFakePng(imagesDir, '02.png');
    writeFakePng(imagesDir, '01.png');
    const mdBefore = fs.readFileSync(mdPath, 'utf8');

    const args = ['writeup', mdPath, '--images', imagesDir, '--dry-run'];
    const first = runCli(args);
    const second = runCli(args);

    expect(first.status).toBe(0);
    expect(first.stdout).toContain('public/writeups/zztest/' + FIXTURE);
    expect(first.stdout).toContain('01.png -> public/writeups/zztest/' + FIXTURE + '/media/01.webp');
    expect(first.stdout).toContain('02.png -> public/writeups/zztest/' + FIXTURE + '/media/02.webp');
    expect(first.stdout).toContain('problems: none');
    // Byte-idempotent: two dry-runs print exactly the same thing.
    expect(second.stdout).toBe(first.stdout);
    // Nothing was created, nothing was rewritten: not in the repo, not at the source.
    expect(fs.existsSync(targetDir)).toBe(false);
    expect(fs.readFileSync(mdPath, 'utf8')).toBe(mdBefore);
  });

  it('non-TTY with missing required fields exits 1 printing the verbatim problem (never hangs)', () => {
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    const mdPath = writeMarkdown(dir, `${FIXTURE}.md`, ['level: Easy', 'categories:', '  - zztest']);
    writeFakePng(imagesDir, '01.png');

    const result = runCli(['writeup', mdPath, '--images', imagesDir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Missing required frontmatter field(s) in ${FIXTURE}.md: title, date`);
    expect(result.stderr).toContain(mdPath);
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it('non-TTY project without --cover exits 1 with the verbatim cover problem', () => {
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    const mdPath = writeMarkdown(dir, 'add-content-e2e-project.md', [
      'title: App',
      'date: "2026-01-01"',
      'group: scripts',
      'tags:',
      '  - Recon',
    ]);
    writeFakePng(imagesDir, 'cover.png');

    const result = runCli(['project', mdPath, '--images', imagesDir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Missing project cover in add-content-e2e-project.md: expected the cover option naming an image file.',
    );
    expect(fs.existsSync(path.join(REPO_ROOT, 'public', 'projects', 'add-content-e2e-project'))).toBe(false);
  });

  it('refuses drafts with the approved message before touching anything', () => {
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    const mdPath = writeMarkdown(dir, `${FIXTURE}.md`, [...writeupYaml, 'draft: true']);
    writeFakePng(imagesDir, '01.png');

    const result = runCli(['writeup', mdPath, '--images', imagesDir, '--dry-run']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('draft: true — not ingesting');
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it('no arguments or an unknown kind prints the usage with the three commands and exits 1', () => {
    const bare = runCli([]);
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain('writeup');
    expect(bare.stderr).toContain('project');
    expect(bare.stderr).toContain('certificate');

    const unknown = runCli(['nope', 'x.md']);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('unknown content kind');
  });
});
