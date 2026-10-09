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
import { buildFrontmatterText, buildWriteupLinks, formatPlan, parseArgs } from '../scripts/add-content.js';
// Namespace import so NEW seam exports fail as named test failures (visible
// RED) instead of a module link error while they do not exist yet.
import * as addContentCli from '../scripts/add-content.js';
import { planContentIngestion } from '../lib/content-ingest.js';
import { assertValidWriteupLinks } from '../lib/content-kinds.js';
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
    // The .md is a SIBLING of its media folder — the layout the indexer scans.
    expect(out).toContain('public/writeups/zztest/wave-fixture.md');
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
// certificate-hires B4: magick honors the per-entry `convert` hint (documented
// order: `-resize <width>x`, then `-quality <q>`, before the target; no hint ⇒
// NO extra args) and the plan output names BOTH certificate artifacts
// ---------------------------------------------------------------------------

describe('magick honors the convert hint (certificate-hires B4)', () => {
  const CERT_YAML = [
    'title: eJPT',
    'order: 2',
    'image: "/certificates/ejpt/media/cover.webp"',
    'description: Certificación eJPT.',
    'group: hack4u',
    'tags:',
    '  - Networking',
  ];
  const PROJECT_YAML = [
    'title: AutoRecon-NG',
    'date: "2026-09-15"',
    'image: "/projects/autorecon-ng/media/cover.webp"',
    'group: scripts',
    'tags:',
    '  - Recon',
  ];
  const certPlan = () =>
    planContentIngestion('certificate', ['---', ...CERT_YAML, '---', ''].join('\n'), 'ejpt.md', ['scan.png'], {
      cover: 'scan.png',
    });
  const projectPlan = () =>
    planContentIngestion('project', ['---', ...PROJECT_YAML, '---', ''].join('\n'), 'app.md', ['01.png', 'cover.jpg'], {
      cover: 'cover.jpg',
    });

  // Spawn recorder: captures every (command, argv) the runner would spawn.
  const recorder = (calls: string[][], result = { status: 0, stderr: '' }) =>
    ((command: string, args: string[] = []) => {
      calls.push([command, ...args]);
      return result;
    }) as never;

  it('maps width/quality hints in the documented order and no hint to no args', () => {
    expect(addContentCli.magickArgs({ quality: 70, width: 800 })).toEqual(['-resize', '800x', '-quality', '70']);
    expect(addContentCli.magickArgs({ width: 800 })).toEqual(['-resize', '800x']);
    expect(addContentCli.magickArgs({ quality: 95 })).toEqual(['-quality', '95']);
    expect(addContentCli.magickArgs(undefined)).toEqual([]);
  });

  it('spawns magick for the certificate cover with -resize 1600x -quality 82 and for hires with -quality 95', () => {
    const calls: string[][] = [];

    const failure = addContentCli.convertImagePlan(certPlan(), '/tmp/scan-dir', recorder(calls));

    expect(failure).toBeNull();
    expect(calls).toEqual([
      [
        'magick',
        path.join('/tmp/scan-dir', 'scan.png'),
        '-resize',
        '1600x',
        '-quality',
        '82',
        path.join(REPO_ROOT, 'public/certificates/ejpt/media/cover.webp'),
      ],
      [
        'magick',
        path.join('/tmp/scan-dir', 'scan.png'),
        '-quality',
        '95',
        path.join(REPO_ROOT, 'public/certificates/ejpt/media/hires.webp'),
      ],
    ]);
  });

  it('spawns magick for a project entry with NO extra args (byte-identical invocation)', () => {
    const calls: string[][] = [];

    const failure = addContentCli.convertImagePlan(projectPlan(), '/tmp/scan-dir', recorder(calls));

    expect(failure).toBeNull();
    expect(calls).toEqual([
      ['magick', path.join('/tmp/scan-dir', '01.png'), path.join(REPO_ROOT, 'public/projects/app/media/01.webp')],
      ['magick', path.join('/tmp/scan-dir', 'cover.jpg'), path.join(REPO_ROOT, 'public/projects/app/media/02.webp')],
      ['magick', path.join('/tmp/scan-dir', 'cover.jpg'), path.join(REPO_ROOT, 'public/projects/app/media/cover.webp')],
    ]);
  });

  it('stops at the first failed conversion and reports it verbatim (fail-loud)', () => {
    const calls: string[][] = [];

    const failure = addContentCli.convertImagePlan(
      certPlan(),
      '/tmp/scan-dir',
      recorder(calls, { status: 1, stderr: 'boom' }),
    );

    expect(calls.length).toBe(1);
    expect(failure).toBe(
      `failed to convert ${path.join('/tmp/scan-dir', 'scan.png')} -> ${path.join(REPO_ROOT, 'public/certificates/ejpt/media/cover.webp')}: boom`,
    );
  });

  it('prints the hires row marked (hires) next to the (cover) row, naming both artifacts', () => {
    const out = formatPlan(certPlan(), '/tmp/ejpt.md');

    expect(out).toContain('scan.png -> public/certificates/ejpt/media/cover.webp   (cover)');
    expect(out).toContain('scan.png -> public/certificates/ejpt/media/hires.webp   (hires)');
  });

  it('marks NO hires row for a project plan (only the cover is an artifact)', () => {
    const out = formatPlan(projectPlan(), '/tmp/app.md');

    expect(out).toContain('cover.jpg -> public/projects/app/media/cover.webp   (cover)');
    expect(out).not.toContain('(hires)');
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
// buildWriteupLinks: pure answers -> optional machineLinks / toolLinks keys
// (feature writeup-links). Expectations derive from the helper INPUTS: the
// assembly echoes answered values and invents nothing — validation belongs to
// assertValidWriteupLinks, never to the assembly.
// ---------------------------------------------------------------------------

describe('buildWriteupLinks', () => {
  it('data carries exactly the answered machine and tool entries (optional empties omitted, developedByAuthor boolean)', () => {
    const machine = [
      { title: 'Wave', url: 'https://hackmyvm.eu/machines/machine.php?vm=Wave', badge: '', type: 'platform' },
      { title: '10.10.10.10', url: '10.10.10.10', badge: ' HMV ', type: '' },
    ];
    const tools = [
      { name: 'nmap', url: 'https://nmap.org', description: '', developedByAuthor: 'n', githubStars: '', badge: '' },
      {
        name: 'autorecon-ng',
        url: 'https://github.com/Tib3rius/AutoRecon',
        description: '  scanner  ',
        developedByAuthor: 'y',
        githubStars: '3.4k',
        badge: 'Python',
      },
    ];

    const links = buildWriteupLinks({ machine, tools });

    // Every kept answer becomes a key with its TRIMMED value; empty optionals
    // never become keys; the y/N answer becomes an always-present boolean.
    expect(links).toEqual({
      machineLinks: [
        { title: machine[0].title, url: machine[0].url, type: machine[0].type },
        { title: machine[1].title, url: machine[1].url, badge: 'HMV' },
      ],
      toolLinks: [
        { name: tools[0].name, url: tools[0].url, developedByAuthor: false },
        {
          name: tools[1].name,
          url: tools[1].url,
          description: 'scanner',
          developedByAuthor: true,
          githubStars: tools[1].githubStars,
          badge: tools[1].badge,
        },
      ],
    });

    // Merged into frontmatter data it carries exactly those objects.
    const data = { title: 'Wave', ...buildWriteupLinks({ machine, tools }) };
    expect(data).toEqual({ title: 'Wave', machineLinks: links.machineLinks, toolLinks: links.toolLinks });
    expect(Object.keys(data)).toEqual(['title', 'machineLinks', 'toolLinks']);
  });

  it('empty or skipped answers add NO machineLinks / toolLinks keys at all', () => {
    expect(buildWriteupLinks({})).toEqual({});
    expect(buildWriteupLinks({ machine: [], tools: [] })).toEqual({});
    // An empty title/name answer is the end-of-list answer, never an entry.
    expect(
      buildWriteupLinks({
        machine: [{ title: '', url: '', badge: '', type: '' }],
        tools: [{ name: '', url: '', description: '', developedByAuthor: '', githubStars: '', badge: '' }],
      }),
    ).toEqual({});

    const data = { title: 'Wave', ...buildWriteupLinks({}) };
    expect('machineLinks' in data).toBe(false);
    expect('toolLinks' in data).toBe(false);
  });

  it('a skipped/empty optional answer never becomes a key (no empty strings, no nulls)', () => {
    expect(buildWriteupLinks({ machine: [{ title: 'X', url: 'u', badge: ' ', type: 'skip' }] })).toEqual({
      machineLinks: [{ title: 'X', url: 'u' }],
    });
    expect(
      buildWriteupLinks({
        tools: [{ name: 'n', url: 'u', description: ' ', developedByAuthor: '', githubStars: ' ' }],
      }),
    ).toEqual({ toolLinks: [{ name: 'n', url: 'u', developedByAuthor: false }] });
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

  it('an assembled structure missing url surfaces the validator problem and writes nothing (plan problems path)', () => {
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    // The same answers drive the assembly AND the fixture: an entry whose url
    // answer came back empty stays assembled WITHOUT a url key (the assembly
    // never invents values) — assertValidWriteupLinks is the fail-loud gate.
    const answers = { machine: [{ title: 'Wave', url: '', badge: '', type: '' }] };
    const links = buildWriteupLinks(answers);
    expect(links.machineLinks).toEqual([{ title: answers.machine[0].title }]);
    const data = {
      title: 'Wave',
      date: '2026-09-15',
      description: 'Writeup de la máquina Wave.',
      categories: ['zztest'],
      level: 'Medium',
      tags: ['File Upload'],
      ...links,
    };
    const mdPath = path.join(dir, `${FIXTURE}.md`);
    fs.writeFileSync(mdPath, buildFrontmatterText(data) + 'Evidencia:\n\n[[01.png]]\n');
    const mdBefore = fs.readFileSync(mdPath, 'utf8');
    writeFakePng(imagesDir, '01.png');

    // The expected problem wording comes from the validator itself over the
    // same assembled structure — never from hardcoded current wording.
    let expectedProblem = '';
    try {
      assertValidWriteupLinks(data, `${FIXTURE}.md`);
    } catch (error) {
      expectedProblem = error instanceof Error ? error.message : String(error);
    }
    expect(expectedProblem).not.toBe('');
    expect(expectedProblem).toContain('url');

    // --dry-run exercises the identical plan-problems gate that precedes
    // every write (pinned above: problems -> exit 1 and nothing written).
    const result = runCli(['writeup', mdPath, '--images', imagesDir, '--dry-run']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedProblem);
    expect(result.stdout).toContain(expectedProblem);
    expect(result.stdout).toContain('problems (');
    // Fail-loud: nothing written anywhere.
    expect(fs.existsSync(targetDir)).toBe(false);
    expect(fs.readFileSync(mdPath, 'utf8')).toBe(mdBefore);
  });

  it('non-TTY writeup runs show NO links prompts and carry no links keys', () => {
    const dir = makeTempDir('starkhack-add-content-');
    const imagesDir = makeTempDir('starkhack-add-content-imgs-');
    const mdPath = writeMarkdown(dir, `${FIXTURE}.md`, writeupYaml, 'Evidencia:\n\n[[01.png]]\n');
    writeFakePng(imagesDir, '01.png');
    const incomplete = writeMarkdown(dir, 'add-content-e2e-incomplete.md', ['level: Easy', 'categories:', '  - zztest']);

    const dryRun = runCli(['writeup', mdPath, '--images', imagesDir, '--dry-run']);
    const nonTty = runCli(['writeup', incomplete, '--images', imagesDir]);

    expect(dryRun.status).toBe(0);
    expect(nonTty.status).toBe(1);
    for (const result of [dryRun, nonTty]) {
      const out = result.stdout + result.stderr;
      expect(out).not.toContain('machineLinks');
      expect(out).not.toContain('toolLinks');
    }
    expect(fs.existsSync(targetDir)).toBe(false);
  });
});
