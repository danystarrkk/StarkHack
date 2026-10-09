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

// Motion CORE contract (site-motion). Pinned SOURCE text for the subtle-motion
// primitives, the reveal utility and its single wiring point in App.tsx.
// Degradation rule under test: the hidden reveal state exists ONLY behind
// `.reveal-ready [data-reveal]`, and everything is neutralized under
// prefers-reduced-motion: reduce.
// NOTE: layer 1 pins behavior that does not hold yet on this branch, so the
// RED phase is expected and recorded before the implementation lands.

describe('motion contract (site-motion)', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'src', 'index.css'), 'utf8');
  const app = fs.readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8');
  const revealPath = path.join(repoRoot, 'src', 'lib', 'reveal.ts');

  it('index.css declares the motion keyframes (dust drift, not grid pulse)', () => {
    expect(css).toContain('@keyframes reveal-in');
    expect(css).toContain('@keyframes glow-breathe');
    expect(css).toContain('@keyframes dust-drift-a');
    expect(css).toContain('@keyframes dust-drift-b');
  });

  it('index.css declares the two floating dust layers', () => {
    expect(css).toContain('.motion-dust-a');
    expect(css).toContain('.motion-dust-b');
  });

  it('index.css must not carry the old grid-breathe opacity pulse (read as a broken screen)', () => {
    expect(css).not.toContain('grid-breathe');
  });

  it('glow-breathe is transform-only so the glow cannot flicker', () => {
    const glowLine =
      css.split('\n').find((line) => line.includes('@keyframes glow-breathe')) ?? '';
    expect(glowLine).toContain('@keyframes glow-breathe');
    expect(glowLine).not.toContain('opacity');
  });

  it('App.tsx renders the two dust layers and no longer pulses the grid', () => {
    expect(app).toContain('motion-dust-a');
    expect(app).toContain('motion-dust-b');
    expect(app).not.toContain('motion-grid');
  });

  it('index.css gates the hidden reveal state behind .reveal-ready [data-reveal] with --reveal-delay', () => {
    expect(css).toContain('.reveal-ready [data-reveal]');
    expect(css).toContain('--reveal-delay');
  });

  it('index.css neutralizes motion under prefers-reduced-motion: reduce', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const guardBlock = css.slice(
      css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/),
    );
    expect(guardBlock).toContain('.motion-dust-a');
    expect(guardBlock).toContain('.motion-dust-b');
    expect(guardBlock).toContain('.motion-streak-a');
  });

  // background-streaks (cierre del fondo): cuatro estelas de acento y un
  // ritmo de ambiente más rápido. Pines de fuente, de velocidad y negativos.
  it('index.css declares the four streak keyframes and their utilities', () => {
    for (const layer of ['a', 'b', 'c', 'd']) {
      expect(css, `@keyframes streak-drift-${layer} must exist`).toContain(
        `@keyframes streak-drift-${layer}`,
      );
      expect(css, `.motion-streak-${layer} must exist`).toContain(
        `.motion-streak-${layer}`,
      );
    }
  });

  it('the streaks paint the accent palette verbatim (cyan, light cyan, green, amber)', () => {
    for (const rgba of [
      'rgba(57,186,230',
      'rgba(106,213,255',
      'rgba(126,220,115',
      'rgba(230,180,80',
    ]) {
      expect(css, `accent ${rgba}...) must be painted`).toContain(rgba);
    }
  });

  it('each ambience loop declares its faster duration and drops the retired one', () => {
    // Pinned PER utility line (not file-wide): a retired value may legitimately
    // reappear elsewhere (e.g. a new streak at 26s) without weakening the check.
    const loops: Array<[selector: string, fast: string, retired: string]> = [
      ['.motion-dust-a', '30s', '55s'],
      ['.motion-dust-b', '48s', '85s'],
      ['.motion-glow-a', '18s', '26s'],
      ['.motion-glow-b', '24s', '34s'],
    ];
    const line = (selector: string): string =>
      css.split('\n').find((row) => row.startsWith(selector)) ?? '';
    for (const [selector, fast, retired] of loops) {
      const declaration = line(selector);
      expect(declaration, `${selector} must exist`).not.toBe('');
      expect(declaration, `${selector} must run at ${fast}`).toContain(fast);
      expect(declaration, `${selector} must drop the retired ${retired}`).not.toContain(retired);
    }
  });

  it('every streak-drift keyframe block is transform-only (opacity would flicker)', () => {
    for (const layer of ['a', 'b', 'c', 'd']) {
      const marker = `@keyframes streak-drift-${layer}`;
      const start = css.indexOf(marker);
      let block = '';
      if (start !== -1) {
        const open = css.indexOf('{', start);
        let depth = 0;
        for (let i = open; i < css.length; i += 1) {
          if (css[i] === '{') depth += 1;
          if (css[i] === '}') depth -= 1;
          if (depth === 0) {
            block = css.slice(start, i + 1);
            break;
          }
        }
      }
      expect(block, `${marker} declaration block must exist`).toContain(marker);
      expect(block, `${marker} must not animate opacity`).not.toContain('opacity');
    }
  });

  it('App.tsx renders exactly the four streak layers', () => {
    expect(app.match(/motion-streak/g)).toHaveLength(4);
  });

  it('src/lib/reveal.ts exists and exports initReveal driven by IntersectionObserver', () => {
    expect(fs.existsSync(revealPath)).toBe(true);
    const reveal = fs.readFileSync(revealPath, 'utf8');
    expect(reveal).toMatch(/export[^;\n]*\binitReveal\b/);
    expect(reveal).toContain('IntersectionObserver');
  });

  it('App.tsx wires initReveal exactly once', () => {
    expect(app).toContain('initReveal');
    expect(app.match(/\binitReveal\s*\(/g)).toHaveLength(1);
  });
});

// Motion SURFACE contract (site-motion, part 1). Pins the consumer side of the
// motion core: the modals use the real `.motion-modal-in` entrance instead of
// the dead `animate-in` group (those classes never existed in the compiled
// CSS), and the Home surfaces carry per-item `data-reveal` so the observer can
// stagger each card sibling.
// NOTE: layer pins behavior that does not hold yet on this branch, so the
// RED phase is expected and recorded before the surface lands.

describe('motion surface contract (site-motion)', () => {
  const mainframeModal = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'MainframeTerminalModal.tsx'),
    'utf8',
  );
  const markdownRenderer = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'MarkdownRenderer.tsx'),
    'utf8',
  );
  const newsWriteups = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'NewsWriteups.tsx'),
    'utf8',
  );
  const featuredProjects = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'FeaturedProjects.tsx'),
    'utf8',
  );
  const terminalHero = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'TerminalHero.tsx'),
    'utf8',
  );
  const writeupsScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'WriteupsScreen.tsx'),
    'utf8',
  );
  const projectsScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'ProjectsScreen.tsx'),
    'utf8',
  );
  const certificationsScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'CertificationsScreen.tsx'),
    'utf8',
  );
  const aboutScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'AboutScreen.tsx'),
    'utf8',
  );

  it('modal sources use motion-modal-in and no dead animate-in classes', () => {
    for (const [name, source] of [
      ['MainframeTerminalModal.tsx', mainframeModal],
      ['MarkdownRenderer.tsx', markdownRenderer],
    ] as const) {
      expect(source, `${name} must use motion-modal-in`).toContain('motion-modal-in');
      expect(source, `${name} must not use the dead animate-in classes`).not.toContain('animate-in');
    }
  });

  it('NewsWriteups, FeaturedProjects and TerminalHero each carry data-reveal', () => {
    for (const [name, source] of [
      ['NewsWriteups.tsx', newsWriteups],
      ['FeaturedProjects.tsx', featuredProjects],
      ['TerminalHero.tsx', terminalHero],
    ] as const) {
      expect(source, `${name} must carry data-reveal`).toContain('data-reveal');
    }
  });

  it('WriteupsScreen, ProjectsScreen and CertificationsScreen each carry data-reveal', () => {
    for (const [name, source] of [
      ['WriteupsScreen.tsx', writeupsScreen],
      ['ProjectsScreen.tsx', projectsScreen],
      ['CertificationsScreen.tsx', certificationsScreen],
    ] as const) {
      expect(source, `${name} must carry data-reveal`).toContain('data-reveal');
    }
  });

  it('the list-card surfaces carry the subtle hover lift', () => {
    for (const [name, source] of [
      ['WriteupsScreen.tsx', writeupsScreen],
      ['ProjectsScreen.tsx', projectsScreen],
      ['CertificationsScreen.tsx', certificationsScreen],
    ] as const) {
      expect(source, `${name} must lift its cards on hover`).toMatch(/hover:-translate-y-(0\.5|1)/);
    }
  });

  it('AboutScreen reveals its top-level section blocks', () => {
    expect(aboutScreen, 'AboutScreen.tsx must carry data-reveal').toContain('data-reveal');
  });
});

// Compiled layer for the motion contract (runs only when dist/assets/*.css
// exists — same policy as the Tailwind-4 compiled layer above).
describeCompiled('motion compiled contract (dist/assets/*.css)', () => {
  it('compiled CSS ships the reveal keyframes and the reduced-motion guard', () => {
    const compiled = fs.readFileSync(builtCssPath as string, 'utf8');
    expect(compiled).toContain('@keyframes reveal-in');
    expect(compiled).toContain('@keyframes glow-breathe');
    expect(compiled).toContain('dust-drift-a');
    expect(compiled).toContain('dust-drift-b');
    expect(compiled).not.toContain('grid-breathe');
    // Minification may drop whitespace inside the media query, so match loose.
    expect(compiled).toMatch(/prefers-reduced-motion/);
  });

  it('compiled CSS ships the streak keyframes and utilities (background-streaks)', () => {
    const compiled = fs.readFileSync(builtCssPath as string, 'utf8');
    expect(compiled).toContain('streak-drift-a');
    expect(compiled).toContain('.motion-streak-a');
  });
});

// Project card cover contract (project-cover-github): when a project entry
// really carries an `image:` cover, both /projects card banners (featured and
// archive) render it as the banner's filled image using the writeup-card cover
// pattern; the dotted-grid + center icon banner stays the fallback for entries
// without one.
// NOTE: this pins behavior that does not hold yet on this branch, so the RED
// phase is expected and recorded before the implementation lands.

describe('project card cover contract (project-cover-github)', () => {
  const projectsScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'ProjectsScreen.tsx'),
    'utf8',
  );
  const featuredProjects = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'FeaturedProjects.tsx'),
    'utf8',
  );

  it('both project card banners render project.image in an <img', () => {
    const coverImgs = projectsScreen.match(/<img[^>]*src=\{project\.image\}[^>]*>/g) ?? [];
    expect(
      coverImgs,
      'the featured and the archive card must each render the real cover in an <img',
    ).toHaveLength(2);
  });

  it('the project cover <img> carries the writeup-card cover classes', () => {
    const coverImgs = projectsScreen.match(/<img[^>]*src=\{project\.image\}[^>]*>/g) ?? [];
    expect(coverImgs.length, 'a cover <img> must exist before its classes can be pinned')
      .toBeGreaterThan(0);
    for (const img of coverImgs) {
      expect(img, 'the cover <img> must use the writeup-card cover classes').toContain(
        'object-cover transition-transform duration-500 group-hover:scale-105',
      );
    }
  });

  it('the Home FeaturedProjects banner renders p.image in an <img', () => {
    const homeCoverImgs = featuredProjects.match(/<img[^>]*src=\{p\.image\}[^>]*>/g) ?? [];
    expect(
      homeCoverImgs,
      'the Home project card must render the real cover in an <img',
    ).toHaveLength(1);
  });

  it('the Home cover <img> carries the writeup-card cover classes and attrs', () => {
    const homeCoverImgs = featuredProjects.match(/<img[^>]*src=\{p\.image\}[^>]*>/g) ?? [];
    expect(
      homeCoverImgs.length,
      'a Home cover <img> must exist before its attributes can be pinned',
    ).toBeGreaterThan(0);
    for (const img of homeCoverImgs) {
      expect(img, 'the Home cover <img> must use the writeup-card cover classes').toContain(
        'object-cover transition-transform duration-500 group-hover:scale-105',
      );
      expect(img, 'the Home cover <img> must load lazily').toContain('loading="lazy"');
      expect(img, 'the decorative Home cover <img> must carry an empty alt').toContain('alt=""');
    }
    expect(
      featuredProjects,
      'the Home banner must keep the NewsWriteups readability scrim over the cover',
    ).toContain('bg-gradient-to-t from-[#0b0e15]/70 via-transparent to-transparent');
  });
});

// Project card tag chip contract (project-cover-github follow-up): each tag
// chip renders ONE bullet before the tag (• Tag), never the old two-dot chip.
// Precise pin by span shape: the statusBadge template lines legitimately keep
// the substring "• • " inside .replace('• • ', ''), so a naive file-wide
// not.toContain('• •') could never go green.

describe('project card tag chip contract (one dot per chip)', () => {
  const projectsScreen = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'ProjectsScreen.tsx'),
    'utf8',
  );

  it('both tag chips render a single dot before {tag}', () => {
    const singleDotChips =
      projectsScreen.match(
        /<span className="text-\[#39bae6\]">•<\/span>\s*\n\s*<span>\{tag\}<\/span>/g,
      ) ?? [];
    expect(
      singleDotChips,
      'the featured and the archive card chip must each render one dot before the tag',
    ).toHaveLength(2);
  });

  it('the two-dot chip span and the old two-dot comment are gone', () => {
    expect(projectsScreen.match(/>• •<\/span>/g) ?? [], 'no chip span may render • •').toHaveLength(
      0,
    );
    expect(projectsScreen, 'the retired "Tags with two dots" comment must be gone').not.toContain(
      'Tags with two dots',
    );
  });
});
