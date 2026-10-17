import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// P2 U1 (p2-structure, H2 of the audit): the honest loading/ready/error fetch
// state machine exists ONCE, in src/lib/useContentQuery.ts. Every routed
// container loads through the hook; no other file hand-rolls its own
// `let cancelled` flag (the vitest environment is `node` — no jsdom — so the
// contract is pinned structurally, the same style as tests/styling.test.ts,
// and the SSR render tests keep pinning the observable markup).
// ---------------------------------------------------------------------------

const read = (relative: string): string =>
  readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const CONTAINERS: Array<{ file: string; loader: string }> = [
  { file: 'src/lib/Home.tsx', loader: 'loadHomeContent' },
  { file: 'src/components/WriteupsScreen.tsx', loader: 'fetchIndex' },
  { file: 'src/components/ProjectsScreen.tsx', loader: 'getProjects' },
  { file: 'src/components/CertificationsScreen.tsx', loader: 'getCertificates' },
  { file: 'src/lib/detailRoutes.tsx', loader: 'resolveWriteupDetail' },
  { file: 'src/lib/detailRoutes.tsx', loader: 'resolveProjectDetail' },
];

function sourceFilesIn(relativeDir: string): string[] {
  const dir = new URL(`../${relativeDir}`, import.meta.url);
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => `${relativeDir}/${name}`);
}

describe('useContentQuery — single fetch state machine (p2 U1)', () => {
  it('exports the shared hook contract', () => {
    const hook = read('src/lib/useContentQuery.ts');
    expect(hook).toContain('export function useContentQuery');
    expect(hook).toMatch(/ContentQueryStatus = 'loading' \| 'ready' \| 'error'/);
  });

  it.each(CONTAINERS)('$file loads through the hook ($loader)', ({ file, loader }) => {
    const source = read(file);
    expect(source).toContain('useContentQuery');
    expect(source).toContain(loader);
  });

  it('no container hand-rolls its own cancelled flag anymore', () => {
    const files = [
      ...sourceFilesIn('src/components'),
      ...sourceFilesIn('src/lib'),
    ].filter((file) => !file.endsWith('useContentQuery.ts'));
    for (const file of files) {
      expect(read(file), `${file} must not hand-roll the fetch state machine`).not.toMatch(
        /let cancelled = false/
      );
    }
  });
});

// ---------------------------------------------------------------------------
// P2 U3 (p2-structure): the compiler runs with full strict mode. Pinned so a
// future tsconfig edit cannot silently regress it.
// ---------------------------------------------------------------------------

describe('tsconfig strict mode (p2 U3)', () => {
  it('keeps strict:true', () => {
    const config = JSON.parse(
      read('tsconfig.json').replace(/\/\/.*$/gm, '')
    ) as { compilerOptions: { strict?: boolean } };
    expect(config.compilerOptions.strict).toBe(true);
  });
});
