// Writeup detail view-model contract: the PURE builder `buildWriteupView`
// (src/lib/writeupView.ts) turns a writeup resolved from the REAL content
// pipeline — the index entry mapped with toUiWriteup plus its real markdown
// document body (pipeline doc.content, carried on `writeup.markdownContent`) —
// into exactly what WriteupPage renders: markdown body, chips, tags, links and
// the sections TOC.
//
// Hard rules under test:
//   1. The body is ALWAYS the real pipeline markdown. The template's
//      SAMPLE_WRITEUPS_CONTENT is never the source of the body (not even when
//      curated template data exists for the slug).
//   2. Chips render only what the real data has. The invented
//      "PWNED: ROOT (100%)" badge is gone for good; DIFICULTAD / OS render
//      only when the field exists.
//   3. Tags come from the real entry only, and absent os / difficulty /
//      vulnerabilities can NEVER crash the builder (the old tags useMemo
//      spread `...writeup.vulnerabilities`).
//   4. machineLinks / toolLinks come ONLY from template curated data and are
//      empty (section hidden) when that data is absent — never fabricated.
//   5. The TOC is extracted from the real markdown body: fenced-code comments
//      are not headings, and every TOC anchor matches the id MarkdownRenderer
//      actually renders (so the sidebar links scroll to the right place).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { toUiWriteup } from '../src/lib/contentAdapter';
import { MarkdownRenderer } from '../src/components/MarkdownRenderer';
import { SAMPLE_WRITEUPS_CONTENT, type RichWriteupData } from '../src/data/writeupContents';
import { buildWriteupView, findCuratedTemplateExtras } from '../src/lib/writeupView';
import type { WriteupIndexItem } from '../types';
import type { Writeup } from '../src/types';

// ---------------------------------------------------------------------------
// Real fixtures straight from the repository (same sources the route loads).
// ---------------------------------------------------------------------------

const REAL_INDEX = JSON.parse(readFileSync('public/index.json', 'utf8')) as WriteupIndexItem[];
const WAVE_ENTRY = REAL_INDEX.find((item) => item.slug === 'wave') as WriteupIndexItem;
const WAVE_BODY = parseFrontmatter<Record<string, never>>(
  readFileSync('public/writeups/hackmyvm/wave.md', 'utf8')
).content;

// Exactly what detailRoutes resolves and passes to WriteupPage for a real
// writeup: the mapped index entry + the real markdown body.
const WAVE_SOURCE: Writeup = {
  ...toUiWriteup(WAVE_ENTRY),
  markdownContent: WAVE_BODY,
};

// The smallest object the pipeline can resolve (no tags / os / difficulty /
// vulnerabilities / summary / markdown body at all).
const BARE_SOURCE: Writeup = {
  id: 'krustykrab',
  title: 'KrustyKrab',
  iconType: 'wave',
};

// A minimal curated-template fixture (links only — the builder must never take
// its body or tags from template data).
const TEMPLATE_FIXTURE: RichWriteupData = {
  markdown: 'MARKDOWN DE PLANTILLA — NUNCA debe ser el cuerpo',
  machineLinks: [
    { title: 'Perfil Oficial', url: 'https://example.test/machine', badge: 'PERFIL OFICIAL', type: 'platform' },
  ],
  toolLinks: [
    { name: 'herramienta', url: 'https://example.test/tool', description: 'recurso de referencia' },
  ],
  tags: ['Tag De Plantilla'],
};

// ---------------------------------------------------------------------------
// 1. Body: the REAL markdown, never template content
// ---------------------------------------------------------------------------

describe('buildWriteupView — body source', () => {
  it('renders the real pipeline markdown as the body', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.markdownContent).toBe(WAVE_BODY);
    expect(view.markdownContent).toContain('# Enumeración');
    expect(view.markdownContent).toContain('sudo arp-scan');
  });

  it('never takes the body from SAMPLE_WRITEUPS_CONTENT, even for a slug with curated template content', () => {
    const curated = SAMPLE_WRITEUPS_CONTENT['hmv-wave'];
    expect(curated).toBeDefined(); // "wave" DOES hold curated template content
    expect(curated.markdown).not.toBe(WAVE_BODY); // and it is a different document
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.markdownContent).not.toBe(curated.markdown);
  });

  it('an absent markdown body yields an empty body — template markdown is still not used', () => {
    const view = buildWriteupView(
      { ...BARE_SOURCE, markdownContent: undefined },
      { template: TEMPLATE_FIXTURE }
    );
    expect(view.markdownContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. Chips: only what the real data has — PWNED badge deleted for good
// ---------------------------------------------------------------------------

describe('buildWriteupView — chips', () => {
  it('renders only the platform chip for pipeline data (no difficulty / os source)', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.chips).toEqual([
      { kind: 'platform', label: 'HACKMYVM', tone: 'platform' },
    ]);
  });

  it('renders DIFICULTAD / OS chips only when the fields exist', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      platformId: 'hackmyvm',
      difficulty: 'MEDIO',
      os: 'LINUX',
    });
    expect(view.chips).toEqual([
      { kind: 'platform', label: 'HACKMYVM', tone: 'platform' },
      { kind: 'difficulty', label: 'DIFICULTAD: MEDIO', tone: 'medium' },
      { kind: 'os', label: 'OS: LINUX', tone: 'neutral' },
    ]);
  });

  it('maps difficulty to honest tones', () => {
    const chipFor = (difficulty: Writeup['difficulty']) =>
      buildWriteupView({ ...BARE_SOURCE, difficulty }).chips.find((c) => c.kind === 'difficulty');
    expect(chipFor('FÁCIL')?.tone).toBe('easy');
    expect(chipFor('MEDIO')?.tone).toBe('medium');
    expect(chipFor('DIFÍCIL')?.tone).toBe('hard');
    expect(chipFor('INSANE')?.tone).toBe('hard');
  });

  it('never emits the invented PWNED / ROOT (100%) badge or any fabricated value', () => {
    const sources: Writeup[] = [
      BARE_SOURCE,
      WAVE_SOURCE,
      { ...BARE_SOURCE, platformId: 'hackmyvm', difficulty: 'DIFÍCIL', os: 'WINDOWS' },
    ];
    for (const source of sources) {
      const labels = buildWriteupView(source).chips.map((chip) => chip.label).join(' | ');
      expect(labels).not.toMatch(/PWNED/i);
      expect(labels).not.toMatch(/100%/);
      expect(labels).not.toMatch(/ROOT/);
      expect(labels).not.toMatch(/undefined/);
      expect(labels).not.toMatch(/:\s*$/); // no empty "DIFICULTAD: " / "OS: " chips
    }
  });

  it('has no platform chip when the pipeline supplies no platform', () => {
    const view = buildWriteupView(BARE_SOURCE);
    expect(view.platformName).toBeUndefined();
    expect(view.chips).toEqual([]);
  });

  it('derives the platform label honestly and never relabels unknown platforms', () => {
    const labelFor = (platformId: Writeup['platformId']) =>
      buildWriteupView({ ...BARE_SOURCE, platformId }).platformName;
    expect(labelFor('hackmyvm')).toBe('HackMyVM');
    expect(labelFor('HackTheBox')).toBe('HackTheBox');
    expect(labelFor('some-oscp-lab')).toBe('some-oscp-lab');
  });
});

// ---------------------------------------------------------------------------
// 3. Tags: real entry data only, crash-safe on absent optional fields
// ---------------------------------------------------------------------------

describe('buildWriteupView — tags', () => {
  it('does not crash when os / difficulty / vulnerabilities are all absent (old tags memo regression)', () => {
    expect(() => buildWriteupView(BARE_SOURCE)).not.toThrow();
    expect(buildWriteupView(BARE_SOURCE).tags).toEqual([]);
  });

  it('uses only the real tags of the entry, normalized', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      tags: ['#Privilege Escalation', '  File Upload  ', ''],
    });
    expect(view.tags).toEqual(['Privilege Escalation', 'File Upload']);
  });

  it('takes no tags from template data', () => {
    const view = buildWriteupView(BARE_SOURCE, { template: TEMPLATE_FIXTURE });
    expect(view.tags).toEqual([]);
    expect(view.tags).not.toContain('Tag De Plantilla');
  });

  it('maps the real metadata the entry supplies and nothing more', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.title).toBe('Wave');
    expect(view.summary).toBe(WAVE_ENTRY.description);
    expect(view.id).toBe('wave');
  });
});

// ---------------------------------------------------------------------------
// 4. Links: ONLY from template curated data — hidden when absent
// ---------------------------------------------------------------------------

describe('buildWriteupView — machineLinks / toolLinks', () => {
  it('takes links only from the curated template data when it exists', () => {
    const curated = SAMPLE_WRITEUPS_CONTENT['hmv-wave'];
    expect(curated).toBeDefined();
    const view = buildWriteupView(WAVE_SOURCE); // id "wave" → curated key "hmv-wave"
    expect(view.machineLinks).toEqual(curated.machineLinks);
    expect(view.toolLinks).toEqual(curated.toolLinks);
  });

  it('hides both link sections (empty lists) when template data is absent', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      id: 'krustykrab', // a real writeup with NO curated template content
    });
    expect(findCuratedTemplateExtras('krustykrab')).toBeNull();
    expect(view.machineLinks).toEqual([]);
    expect(view.toolLinks).toEqual([]);
  });

  it('never fabricates links (the generated template fallback is not a source)', () => {
    const view = buildWriteupView({ ...BARE_SOURCE, id: 'krustykrab' });
    const urls = [...view.machineLinks, ...view.toolLinks].map((l) => l.url);
    expect(urls).not.toContain(
      'https://github.com/danystark/stark-recon-suite' // the generated fallback's fake link
    );
    expect(urls).toEqual([]);
  });

  it('accepts explicit template data and never invents links for it', () => {
    const view = buildWriteupView(WAVE_SOURCE, { template: TEMPLATE_FIXTURE });
    expect(view.machineLinks).toEqual(TEMPLATE_FIXTURE.machineLinks);
    expect(view.toolLinks).toEqual(TEMPLATE_FIXTURE.toolLinks);
    // explicitly NO template data → no links even for a slug with curated content
    const none = buildWriteupView(WAVE_SOURCE, { template: null });
    expect(none.machineLinks).toEqual([]);
    expect(none.toolLinks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Sections TOC from the real markdown — correct and anchored
// ---------------------------------------------------------------------------

describe('buildWriteupView — sections TOC', () => {
  it('extracts the real section list from the pipeline markdown', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.headings).toHaveLength(9);
    expect(view.headings.map((h) => h.cleanText)).toEqual([
      'Enumeración',
      'Explotación',
      'Escalando Privilegios 1',
      'Escalada de Privilegios 2',
      'Mitigaciones',
      'Exposición de información sensible y copias de seguridad',
      'Ausencia de control de integridad y detección de webshells',
      'Configuración insegura de servicios y escritura en directorios críticos',
      'Configuración permisiva de Sudo',
    ]);
    expect(view.headings[0].level).toBe(1);
    expect(view.headings[5].level).toBe(2);
  });

  it('fenced-code comments are not headings', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      markdownContent: [
        '# Real',
        '',
        '```bash',
        '# comentario de shell, no es un encabezado',
        'echo "# tampoco"',
        '```',
        '',
        '## También real',
        '',
        '# Real',
      ].join('\n'),
    });
    expect(view.headings.map((h) => h.cleanText)).toEqual(['Real', 'También real', 'Real']);
  });

  it('every TOC anchor matches the id MarkdownRenderer renders', () => {
    const fixtures = [WAVE_BODY, buildWriteupView({
      ...BARE_SOURCE,
      markdownContent: [
        '# Duplicado',
        '',
        '```bash',
        '# comentario dentro de código',
        '```',
        '',
        '## Duplicado',
        '',
        '# Duplicado',
        '',
        '# !!',
        '',
        '## Válido',
      ].join('\n'),
    }).markdownContent];
    for (const markdown of fixtures) {
      const { headings } = buildWriteupView({ ...BARE_SOURCE, markdownContent: markdown });
      const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: markdown }));
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings) {
        expect(markup, `anchor ${heading.id} must exist in the rendered document`).toContain(
          `id="${heading.id}"`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Purity + the page itself (rendered): real body in, invented badges out
// ---------------------------------------------------------------------------

describe('buildWriteupView — purity', () => {
  it('is pure and synchronous', () => {
    const before = structuredClone(WAVE_SOURCE);
    const first = buildWriteupView(WAVE_SOURCE);
    const second = buildWriteupView(WAVE_SOURCE);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(WAVE_SOURCE).toEqual(before); // input untouched
  });
});

describe('WriteupPage (rendered with real pipeline data)', () => {
  // Dynamic import keeps the RED failure honest: today the view module does not
  // exist yet, and WriteupPage must consume it instead of template content.
  const renderPage = async (source: Writeup): Promise<string> => {
    const { WriteupPage } = await import('../src/components/WriteupPage');
    return renderToStaticMarkup(
      createElement(WriteupPage, { writeup: source, onBack: () => undefined })
    );
  };

  it('renders the real markdown body for /writeups/hackmyvm/wave', async () => {
    const markup = await renderPage(WAVE_SOURCE);
    expect(markup).toContain('Enumeración');
    expect(markup).toContain('sudo arp-scan');
  });

  it('shows no invented badges and hides DIFICULTAD / OS on real data', async () => {
    const markup = await renderPage(WAVE_SOURCE);
    expect(markup).not.toMatch(/PWNED/i);
    expect(markup).not.toContain('DIFICULTAD:');
    expect(markup).not.toContain('OS:');
  });

  it('renders link sections only when template data provides them', async () => {
    const withLinks = await renderPage(WAVE_SOURCE);
    expect(withLinks).toContain('ENLACES DE LA MÁQUINA');
    expect(withLinks).toContain('HERRAMIENTAS');
    expect(withLinks).toContain('OTROS LINKS');
    const withoutLinks = await renderPage({
      ...BARE_SOURCE,
      id: 'krustykrab',
      markdownContent: '# Hola',
    });
    expect(withoutLinks).not.toContain('ENLACES DE LA MÁQUINA');
    expect(withoutLinks).not.toContain('OTROS LINKS');
    expect(withoutLinks).toContain('Hola'); // body still renders
  });
});
