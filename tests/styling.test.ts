import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Permanent guard for the Tailwind 4 migration contract (R3-majors-unasserted).
// Two layers:
//   1. SOURCE contract (always runs): the v4 entrypoints and the Nord palette
//      config are pinned in the repository sources.
//   2. COMPILED contract (runs when dist/assets/*.css exists): the built CSS
//      actually carries the Nord utilities and no v3 @tailwind directives.
//      Skipped with an explicit note on an unbuilt tree — never a suite failure.
//
// NOTE: layer 1 pins behavior that already holds, so no RED phase applies here.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('styling source contract (Tailwind 4 migration)', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'src', 'index.css'), 'utf8');
  const postcss = fs.readFileSync(path.join(repoRoot, 'postcss.config.js'), 'utf8');
  const tailwind = fs.readFileSync(path.join(repoRoot, 'tailwind.config.js'), 'utf8');

  it('index.css begins with the Tailwind v4 import', () => {
    expect(css).toMatch(/^\s*@import "tailwindcss";/);
  });

  it('index.css declares @config "../tailwind.config.js";', () => {
    expect(css).toContain('@config "../tailwind.config.js";');
  });

  it('index.css contains no v3 @tailwind base|components|utilities directive', () => {
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)\b/);
  });

  it('postcss.config.js registers @tailwindcss/postcss', () => {
    expect(postcss).toContain('@tailwindcss/postcss');
  });

  it('tailwind.config.js exposes the Nord palette keys nord0, nord7 and deep-bg', () => {
    expect(tailwind).toMatch(/nord0:\s*"#2e3440"/);
    expect(tailwind).toMatch(/nord7:\s*"#8fbcbb"/);
    expect(tailwind).toMatch(/"deep-bg":\s*"#13151a"/);
  });
});

const assetsDir = path.join(repoRoot, 'dist', 'assets');
const builtCssPath = fs.existsSync(assetsDir)
  ? fs
      .readdirSync(assetsDir)
      .filter((fileName) => fileName.endsWith('.css'))
      .sort()
      .map((fileName) => path.join(assetsDir, fileName))[0]
  : undefined;

const describeCompiled = builtCssPath ? describe : describe.skip;

if (!builtCssPath) {
  // Explicit note: the compiled layer is skipped on an unbuilt tree BY DESIGN.
  // Run `npm run build` and re-run this file to exercise it.
  console.warn(
    '[styling.test] compiled contract SKIPPED: no dist/assets/*.css found (unbuilt tree). Run `npm run build` to execute layer 2.',
  );
}

describeCompiled('styling compiled contract (dist/assets/*.css)', () => {
  it('compiled CSS carries the Nord palette utilities and zero @tailwind directives', () => {
    const compiled = fs.readFileSync(builtCssPath as string, 'utf8');

    expect(compiled).toContain('.bg-deep-bg');
    expect(compiled).toContain('.text-nord7');
    // Phase 2.3: nord0 (#2e3440) lost its last consumer with the old frontend,
    // so Tailwind no longer emits it. The hex-level palette check pins nord7
    // (emitted via .text-nord7) instead — same intent, surviving utility.
    expect(compiled.toLowerCase()).toContain('#8fbcbb');
    expect(compiled).not.toContain('@tailwind ');
  });
});
