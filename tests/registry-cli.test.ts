// Integration contract for scripts/registry.js (R2): the CLI that plans and
// applies CLOSED-REGISTRY additions — platform icon, tag, group — in ONE step
// (the implementation file AND its approval pin together), plus the read-only
// `list` audit that shows the gaps (odd/tasks/registry.md).
//
// Honesty rules under test:
//   - parseArgs is pure (the four command shapes + every shape error in the
//     scripts/add-content.js message style) and never touches the filesystem;
//   - formatPlan/formatList are pure and byte-deterministic (no timestamps, no
//     randomness): the plan renders the exact `+ <line>` insertion preview,
//     the non-blocking notes, the per-kind UI pendings and every problem
//     VERBATIM; the list renders tag counts, the platform registration state
//     and the GAP flag line;
//   - the script exports the three helpers and guards main() with
//     import.meta.url (the repo CLI pattern of add-content/edit-content);
//   - headless runs never hang and never write: with --dry-run the plan prints
//     and the run exits 0 (the headless escape hatch); without --dry-run the
//     run exits 1 with an explicit message and the working tree is UNCHANGED
//     (`git status --porcelain` compared before/after).
//
// Spawned runs use `timeout 15 node scripts/registry.js …` with stdin at
// /dev/null (never a TTY), mirroring the read-only sanity commands.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatList, formatPlan, parseArgs } from '../scripts/registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'registry.js');

/** Spawn the real CLI headless: `timeout 15 …` with stdin at /dev/null. */
function runCli(args: string[]) {
  return spawnSync('timeout', ['15', process.execPath, CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Read-only working-tree snapshot (`git status` never mutates). */
function gitStatus(): string {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.status).toBe(0);
  return result.stdout;
}

// ---------------------------------------------------------------------------
// parseArgs: the four command shapes and every failure mode
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses `list`', () => {
    expect(parseArgs(['list'])).toEqual({ op: 'list', dryRun: false });
    expect(parseArgs(['list', '--dry-run'])).toEqual({ op: 'list', dryRun: true });
  });

  it('parses `platform <name> [--icon <i>] [--dry-run]`', () => {
    expect(parseArgs(['platform', 'hackmyvm', '--icon', 'wave', '--dry-run'])).toEqual({
      op: 'platform',
      name: 'hackmyvm',
      icon: 'wave',
      dryRun: true,
    });
  });

  it('parses `platform` without --icon: the TTY prompt / non-TTY requirement supplies it later', () => {
    const args = parseArgs(['platform', 'hackmyvm']);
    expect(args.op).toBe('platform');
    expect(args.name).toBe('hackmyvm');
    expect(args.icon).toBeUndefined();
  });

  it('parses `tag <tag>` defaulting --kind to writeup', () => {
    expect(parseArgs(['tag', 'Exposure'])).toEqual({
      op: 'tag',
      tag: 'Exposure',
      kind: 'writeup',
      dryRun: false,
    });
  });

  it('parses `tag <tag> --kind <kind>` and `group <slug> --kind <kind> [--label <LABEL>]`', () => {
    expect(parseArgs(['tag', 'Exposure', '--kind', 'certificate', '--dry-run'])).toEqual({
      op: 'tag',
      tag: 'Exposure',
      kind: 'certificate',
      dryRun: true,
    });
    expect(parseArgs(['group', 'oscp', '--kind', 'project', '--label', 'OSCP'])).toEqual({
      op: 'group',
      slug: 'oscp',
      kind: 'project',
      label: 'OSCP',
      dryRun: false,
    });
  });

  it('accepts `group` without --label: the planner defaults it to the slug uppercased', () => {
    const args = parseArgs(['group', 'oscp', '--kind', 'certificate']);
    expect(args.kind).toBe('certificate');
    expect(args.label).toBeUndefined();
  });

  it('rejects a missing or unknown operation', () => {
    expect(() => parseArgs([])).toThrow(/missing operation/);
    expect(() => parseArgs(['nope', 'x'])).toThrow(/unknown operation: "nope"/);
  });

  it('rejects a missing name/tag/slug operand', () => {
    expect(() => parseArgs(['platform'])).toThrow(/missing <name> for platform/);
    expect(() => parseArgs(['tag'])).toThrow(/missing <tag> for tag/);
    expect(() => parseArgs(['group'])).toThrow(/missing <slug> for group/);
  });

  it('rejects unknown flags and flags that do not apply to the operation', () => {
    expect(() => parseArgs(['list', '--wtf'])).toThrow(/unknown option: --wtf/);
    expect(() => parseArgs(['tag', 'Exposure', '--wtf', 'x'])).toThrow(/unknown option: --wtf/);
    expect(() => parseArgs(['platform', 'x', '--label', 'L'])).toThrow(/--label is not valid for platform/);
    expect(() => parseArgs(['tag', 'Exposure', '--icon', 'wave'])).toThrow(/--icon is not valid for tag/);
    expect(() => parseArgs(['list', '--kind', 'writeup'])).toThrow(/--kind is not valid for list/);
  });

  it('requires --kind for `group`', () => {
    expect(() => parseArgs(['group', 'oscp'])).toThrow(/group requires --kind/);
  });

  it('rejects an invalid --kind value per operation', () => {
    expect(() => parseArgs(['tag', 'Exposure', '--kind', 'nope'])).toThrow(/invalid --kind value: "nope"/);
    expect(() => parseArgs(['group', 'oscp', '--kind', 'writeup'])).toThrow(/invalid --kind value: "writeup"/);
  });

  it('rejects a flag without its value', () => {
    expect(() => parseArgs(['platform', 'x', '--icon'])).toThrow(/--icon requires a value/);
    expect(() => parseArgs(['group', 'oscp', '--kind'])).toThrow(/--kind requires a value/);
    expect(() => parseArgs(['group', 'oscp', '--kind', '--dry-run'])).toThrow(/--kind requires a value/);
    expect(() => parseArgs(['tag', 'Exposure', '--kind'])).toThrow(/--kind requires a value/);
    expect(() => parseArgs(['group', 'oscp', '--kind', 'project', '--label'])).toThrow(/--label requires a value/);
  });

  it('rejects stray positional arguments', () => {
    expect(() => parseArgs(['list', 'extra'])).toThrow(/unexpected argument: "extra"/);
    expect(() => parseArgs(['tag', 'Exposure', 'extra'])).toThrow(/unexpected argument: "extra"/);
    expect(() => parseArgs(['group', 'oscp', '--kind', 'project', 'extra'])).toThrow(/unexpected argument/);
  });
});

// ---------------------------------------------------------------------------
// formatPlan: the `+ <line>` insertion preview, notes, UI pendings, problems
// verbatim, byte-deterministic
// ---------------------------------------------------------------------------

describe('formatPlan', () => {
  const identity = { op: 'tag', kind: 'writeup', tag: 'Exposure' } as const;

  // A realistic tag plan: one inserted entry per file (implementation first,
  // approval pin second), previewed from the before/after source pair.
  const tagResult = () => ({
    plan: {
      problems: [],
      files: [
        { name: 'lib/taxonomy.js', source: 'export const TAGS = Object.freeze([\n  "Exposure",\n]);\n' },
        { name: 'tests/taxonomy.test.ts', source: "const APPROVED_TAGS = [\n  'Exposure',\n];\n" },
      ],
      notes: [],
    },
    sources: {
      'lib/taxonomy.js': 'export const TAGS = Object.freeze([\n]);\n',
      'tests/taxonomy.test.ts': 'const APPROVED_TAGS = [\n];\n',
    },
  });

  it('renders the two target files with their exact `+ <line>` insertion previews', () => {
    const out = formatPlan(tagResult(), identity);

    expect(out).toContain('=== registry plan ===');
    expect(out).toContain('change: tag "Exposure" (kind: writeup)');
    expect(out).toContain('lib/taxonomy.js');
    expect(out).toContain('tests/taxonomy.test.ts');
    // The exact inserted line of each file, `+ <line>` style (the motor keeps
    // each block's quote style, so the preview shows the real bytes).
    expect(out).toContain('+ "Exposure",');
    expect(out).toContain("+ 'Exposure',");
    expect(out).toContain('notes: none');
    expect(out).toContain('problems: none');
  });

  it('renders the non-blocking notes and the per-kind UI pendings', () => {
    const result = {
      plan: {
        problems: [],
        files: [{ name: 'lib/content-kinds.js', source: "const GROUPS = ['a', 'new'];\n" }],
        notes: ['Platform "x" uses the fallback icon "bug": indistinguishable from unregistered platforms in the UI.'],
        label: 'NEW',
      },
      sources: { 'lib/content-kinds.js': "const GROUPS = ['a'];\n" },
      ui: [
        { file: 'src/lib/projectsModel.ts', hint: "add 'new' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES" },
      ],
    };
    const out = formatPlan(result, { op: 'group', kind: 'project', slug: 'new' });

    expect(out).toContain('label: NEW');
    expect(out).toContain('notes (1):');
    expect(out).toContain('Platform "x" uses the fallback icon "bug"');
    expect(out).toContain('UI pending (1 files):');
    expect(out).toContain("src/lib/projectsModel.ts: add 'new' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES");
  });

  it('renders every problem verbatim and shows no files when the plan is blocked', () => {
    const result = {
      plan: {
        problems: [
          'Duplicate tag in writeup tag vocabulary: "Exposure" is already used by "Exposed Service".',
          'Missing TAGS list in lib/taxonomy.js: expected the [...] block.',
        ],
        files: [],
        notes: [],
      },
      sources: {},
    };
    const out = formatPlan(result, identity);

    expect(out).toContain('problems (2):');
    for (const problem of result.plan.problems) expect(out).toContain(problem);
  });

  it('renders one exact `+ <line>` row even when the inserted value shares a prefix with its neighbour', () => {
    // 'Exposure' lands between 'Exposed Service' and 'File Inclusion': a naive
    // character diff would blur it into its neighbour. The preview must show
    // the whole inserted line, and only it.
    const result = {
      plan: {
        problems: [],
        files: [
          {
            name: 'lib/taxonomy.js',
            source:
              'export const TAGS = Object.freeze([\n  "Exposed Service",\n  "Exposure",\n  "File Inclusion",\n]);\n',
          },
        ],
        notes: [],
      },
      sources: {
        'lib/taxonomy.js': 'export const TAGS = Object.freeze([\n  "Exposed Service",\n  "File Inclusion",\n]);\n',
      },
    };
    const out = formatPlan(result, identity);

    expect(out).toContain('+ "Exposure",');
    const rows = out.split('\n').filter((line) => line.trimStart().startsWith('+ '));
    expect(rows).toEqual(['    + "Exposure",']);
  });

  it('renders the exact inserted token for an inline list splice (group lists)', () => {
    // The group lists are inline (`['a', 'scripts']`): the splice is a token,
    // not a line. 'scripting' shares a prefix with its neighbour 'scripts'.
    const result = {
      plan: {
        problems: [],
        files: [
          {
            name: 'lib/content-kinds.js',
            source: "export const PROJECT_GROUPS = Object.freeze(['a', 'scripts', 'scripting']);\n",
          },
        ],
        notes: [],
      },
      sources: {
        'lib/content-kinds.js': "export const PROJECT_GROUPS = Object.freeze(['a', 'scripts']);\n",
      },
    };
    const out = formatPlan(result, { op: 'group', kind: 'project', slug: 'scripting' });

    const rows = out.split('\n').filter((line) => line.trimStart().startsWith('+ '));
    expect(rows).toEqual(["    + 'scripting'"]);
  });

  it('is byte-identical across two calls (no timestamps, no randomness)', () => {
    expect(formatPlan(tagResult(), identity)).toBe(formatPlan(tagResult(), identity));
  });
});

// ---------------------------------------------------------------------------
// formatList: the read-only audit — tag counts, groups, platform registration
// state and the GAP flag line; byte-deterministic
// ---------------------------------------------------------------------------

describe('formatList', () => {
  const report = () => ({
    tags: {
      writeup: ['Exposed Service', 'File Upload'],
      project: ['Recon'],
      certificate: ['Cloud', 'Web Security', 'Linux'],
    },
    groups: { project: ['scripts', 'oscp'], certificate: ['universidad'] },
    platforms: {
      registered: [
        { name: 'hackmyvm', icon: 'wave' },
        { name: 'hackthebox', icon: 'server' },
      ],
      used: ['hackmyvm', 'zz-gap-platform'],
      missing: ['zz-gap-platform'],
    },
    groupUi: [
      { kind: 'project', slug: 'scripts', ready: ['src/lib/projectsModel.ts'], pending: [] },
      {
        kind: 'project',
        slug: 'oscp',
        ready: [],
        pending: [
          { file: 'src/lib/projectsModel.ts', hint: "add 'oscp' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES" },
          { file: 'src/components/ProjectsScreen.tsx', hint: "add a getCategoryBadgeStyle case for the 'oscp' label" },
        ],
      },
      { kind: 'certificate', slug: 'universidad', ready: ['src/lib/certificationsModel.ts'], pending: [] },
    ],
  });

  it('renders the tag counts per kind and the groups per kind', () => {
    const out = formatList(report());

    expect(out).toContain('=== registry list ===');
    expect(out).toContain('writeup (2): Exposed Service, File Upload');
    expect(out).toContain('project (1): Recon');
    expect(out).toContain('certificate (3): Cloud, Web Security, Linux');
    expect(out).toContain('project (2): scripts, oscp');
    expect(out).toContain('certificate (1): universidad');
  });

  it('renders the platform registration state and the GAP flag line', () => {
    const out = formatList(report());

    expect(out).toContain('WRITEUP_ICON_BY_PLATFORM (2): hackmyvm=wave, hackthebox=server');
    expect(out).toContain('public/index.json (2): hackmyvm, zz-gap-platform');
    // The gap flag: a platform used by content but missing from the icon map
    // renders the documented `bug` fallback in the UI.
    expect(out).toMatch(/GAP:.*zz-gap-platform/);
  });

  it('renders the per-group UI audit as `ok` or `pending (n files)`', () => {
    const out = formatList(report());

    expect(out).toContain('scripts: ok');
    expect(out).toContain('universidad: ok');
    expect(out).toContain('oscp: pending (2 files)');
    expect(out).toContain("add 'oscp' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES");
  });

  it('is byte-identical across two calls (no timestamps, no randomness)', () => {
    expect(formatList(report())).toBe(formatList(report()));
  });

  it('reports `GAP: none` when every used platform is registered', () => {
    const clean = report();
    clean.platforms = { registered: clean.platforms.registered, used: ['hackmyvm'], missing: [] };
    expect(formatList(clean)).toContain('GAP: none');
  });
});

// ---------------------------------------------------------------------------
// Source contract: three exported helpers + a main() guarded by import.meta.url
// ---------------------------------------------------------------------------

describe('scripts/registry.js source contract', () => {
  const source = fs.readFileSync(CLI_PATH, 'utf8');

  it('exports parseArgs, formatPlan and formatList as functions', () => {
    expect(typeof parseArgs).toBe('function');
    expect(typeof formatPlan).toBe('function');
    expect(typeof formatList).toBe('function');
    expect(source).toMatch(/export function parseArgs\(/);
    expect(source).toMatch(/export function formatPlan\(/);
    expect(source).toMatch(/export function formatList\(/);
  });

  it('guards main() with the import.meta.url runner check', () => {
    expect(source).toContain('import.meta.url');
    expect(source).toMatch(/process\.argv\[1\][^\n]*import\.meta\.url|import\.meta\.url[^\n]*process\.argv\[1\]/);
    expect(source).toMatch(/export async function main\(/);
  });
});

// ---------------------------------------------------------------------------
// Headless behaviour (spawned, stdin at /dev/null): never hangs, never writes
// ---------------------------------------------------------------------------

describe('registry CLI (spawned, non-TTY)', () => {
  it('--dry-run prints the plan and exits 0 without a TTY (the headless escape hatch)', () => {
    const before = gitStatus();
    const result = runCli(['tag', 'Exposure', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('=== registry plan ===');
    expect(result.stdout).toContain('lib/taxonomy.js');
    expect(result.stdout).toContain('tests/taxonomy.test.ts');
    expect(result.stdout).toContain('Dry run: nothing written.');
    expect(gitStatus()).toBe(before);
  });

  it('without --dry-run exits 1 with an explicit message and writes nothing', () => {
    const before = gitStatus();
    const result = runCli(['tag', 'Exposure']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('=== registry plan ===');
    expect(result.stderr).toMatch(/TTY/);
    expect(gitStatus()).toBe(before);
  });

  it('`list` is read-only and exits 0 headless', () => {
    const before = gitStatus();
    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('=== registry list ===');
    expect(result.stdout).toContain('GAP:');
    expect(gitStatus()).toBe(before);
  });

  it('no arguments exits 1 printing the usage with the four commands', () => {
    const result = runCli([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
    expect(result.stderr).toContain('node scripts/registry.js list');
    expect(result.stderr).toContain('node scripts/registry.js platform');
    expect(result.stderr).toContain('node scripts/registry.js tag');
    expect(result.stderr).toContain('node scripts/registry.js group');
  });
});
