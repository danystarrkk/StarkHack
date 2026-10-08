import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';

describe('parseFrontmatter', () => {
  it('splits valid frontmatter into data and body', () => {
    const text = '---\ntitle: "Wave"\nlevel: Medium\ntags: ["a", "b"]\n---\n\n# Heading\n\nBody text.\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({ title: 'Wave', level: 'Medium', tags: ['a', 'b'] });
    expect(content).toBe('\n# Heading\n\nBody text.\n');
  });

  it('parses frontmatter preceded by a UTF-8 BOM (R3-03)', () => {
    const text = '\uFEFF---\ntitle: X\n---\nbody';

    const { data, content } = parseFrontmatter(text);

    expect(data.title).toBe('X');
    expect(content).toBe('body');
  });

  it('parses BOM + CRLF frontmatter', () => {
    const text = '\uFEFF---\r\ntitle: "Bom CRLF"\r\n---\r\nbody\r\n';

    const { data, content } = parseFrontmatter(text);

    expect(data.title).toBe('Bom CRLF');
    expect(content).toBe('body\r\n');
  });

  it('keeps a BOM-prefixed text unchanged when frontmatter is missing', () => {
    const text = '\uFEFF# Just a body\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe(text);
  });

  it('returns the text unchanged when frontmatter is missing', () => {
    const text = '# Just a body\n\nNo frontmatter here.\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe(text);
  });

  it('parses frontmatter delimited with CRLF line endings', () => {
    const text = '---\r\ntitle: "CRLF"\r\nlevel: Hard\r\n---\r\n\r\n# Body\r\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({ title: 'CRLF', level: 'Hard' });
    expect(content).toContain('# Body');
    expect(content).not.toBe(text);
  });

  it('parses a multiline flow array with a trailing comma (wave.md format)', () => {
    const text = [
      '---',
      'title: "Wave"',
      'tags:',
      '  [',
      '    "Information Disclosure",',
      '    "Remote Code Execution",',
      '    "Privilege Escalation",',
      '  ]',
      '---',
      '',
      '# Body',
      '',
    ].join('\n');

    const { data } = parseFrontmatter(text);

    expect(data.tags).toEqual([
      'Information Disclosure',
      'Remote Code Execution',
      'Privilege Escalation',
    ]);
  });

  it('normalizes a YAML date timestamp to a "YYYY-MM-DD" string', () => {
    const { data } = parseFrontmatter('---\ntitle: "D"\ndate: 2026-09-15\n---\nbody\n');

    expect(data.date).toBe('2026-09-15');
    expect(typeof data.date).toBe('string');
  });

  it('throws an Error starting with "Invalid YAML frontmatter" on invalid YAML', () => {
    const text = '---\ntitle: [unterminated\n---\nbody\n';

    expect(() => parseFrontmatter(text)).toThrowError(/^Invalid YAML frontmatter/);
  });

  it('returns empty data when the frontmatter block contains only comments', () => {
    const text = '---\n# just a comment\n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });

  it('returns empty data when the frontmatter block is completely empty', () => {
    const text = '---\n\n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });

  it('returns empty data when the block holds only a YAML document marker (R3-blank-frontmatter-comment-branch)', () => {
    // `...` cierra un documento YAML: no aporta metadatos y js-yaml 5 tira
    // "expected a document". Sin este caso el generador se rompe con un
    // error que ni nombra al archivo.
    const text = '---\n...\n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });

  it('returns empty data when the block holds only whitespace lines', () => {
    const text = '---\n   \n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });

  it('returns empty data when the frontmatter block parses to a scalar', () => {
    const text = '---\njust a plain scalar\n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });

  it('returns empty data when the frontmatter block is a bare date scalar', () => {
    const text = '---\n2026-01-02\n---\nbody stays\n';

    const { data, content } = parseFrontmatter(text);

    expect(data).toEqual({});
    expect(content).toBe('body stays\n');
  });
});
