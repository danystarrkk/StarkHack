import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCertificate,
  fetchIndex,
  fetchIndexByKind,
  fetchProject,
  getCertificates,
  getProjects,
} from '../lib/content';
import type { ContentIndexItem } from '../types';

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function textResponse(body: string): Response {
  return { ok: true, text: async () => body } as unknown as Response;
}

function notOkResponse(): Response {
  return { ok: false } as unknown as Response;
}

// A mixed index like the one public/index.json will hold from Phase 2 on:
// one entry per kind, deliberately interleaved.
const mixedIndex: ContentIndexItem[] = [
  {
    kind: 'writeup',
    title: 'W1',
    date: '2026-01-01',
    platform: 'hackmyvm',
    slug: 'w1',
    path: '/writeups/hackmyvm/w1.md',
  },
  {
    kind: 'certificate',
    title: 'Cert B',
    slug: 'cert-b',
    path: '/certificates/cert-b.md',
    order: 2,
    image: '/certificates/cert-b/media/cover.webp',
    description: 'B',
  },
  {
    kind: 'project',
    title: 'Proj 1',
    date: '2026-02-02',
    slug: 'proj-1',
    path: '/projects/proj-1.md',
    image: '/projects/proj-1/media/cover.webp',
  },
  {
    kind: 'certificate',
    title: 'Cert A',
    slug: 'cert-a',
    path: '/certificates/cert-a.md',
    order: 1,
    image: '/certificates/cert-a/media/cover.webp',
    description: 'A',
  },
  {
    kind: 'writeup',
    title: 'W2',
    date: '2026-03-03',
    platform: 'tryhackme',
    slug: 'w2',
    path: '/writeups/tryhackme/w2.md',
  },
  {
    kind: 'project',
    title: 'Proj 2',
    slug: 'proj-2',
    path: '/projects/proj-2.md',
    image: '/projects/proj-2/media/cover.webp',
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchIndex with a multi-kind index', () => {
  it('returns ONLY writeup entries so the untouched UI never lists projects as machines', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mixedIndex));

    const items = await fetchIndex();

    expect(items.map((item) => item.slug)).toEqual(['w1', 'w2']);
    expect(items.every((item) => item.kind === 'writeup')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/index.json');
  });
});

describe('fetchIndexByKind', () => {
  it('returns only the requested kind', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mixedIndex));

    await expect(fetchIndexByKind('project')).resolves.toEqual([mixedIndex[2], mixedIndex[5]]);
    await expect(fetchIndexByKind('certificate')).resolves.toEqual([mixedIndex[1], mixedIndex[3]]);
  });

  it('returns an empty list when the kind has no entries', async () => {
    fetchMock.mockResolvedValue(jsonResponse([mixedIndex[0]]));

    await expect(fetchIndexByKind('project')).resolves.toEqual([]);
  });
});

describe('getProjects / getCertificates', () => {
  it('getProjects returns only project entries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mixedIndex));

    const projects = await getProjects();

    expect(projects.map((item) => item.slug)).toEqual(['proj-1', 'proj-2']);
    expect(projects.every((item) => item.kind === 'project')).toBe(true);
  });

  it('getCertificates returns certificates sorted ascending by order', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mixedIndex));

    const certificates = await getCertificates();

    // Fixture order is cert-b (2) before cert-a (1): the result must reorder.
    expect(certificates.map((item) => item.slug)).toEqual(['cert-a', 'cert-b']);
    expect(certificates.map((item) => item.order)).toEqual([1, 2]);
  });
});

describe('fetchProject / fetchCertificate', () => {
  it('fetchProject loads /projects/<slug>.md and parses frontmatter like fetchWriteup', async () => {
    const markdown =
      '---\ntitle: "Tool"\ndate: 2026-04-04\nimage: "/projects/tool/media/cover.webp"\n---\n\n# Body\n\nText.\n';
    fetchMock.mockResolvedValue(textResponse(markdown));

    const result = await fetchProject('tool');

    expect(fetchMock).toHaveBeenCalledWith('/projects/tool.md');
    expect(result).toEqual({
      slug: 'tool',
      content: '\n# Body\n\nText.\n',
      title: 'Tool',
      date: '2026-04-04',
      image: '/projects/tool/media/cover.webp',
    });
  });

  it('fetchCertificate loads /certificates/<slug>.md and keeps the integer order', async () => {
    const markdown =
      '---\ntitle: "OSCP"\norder: 3\nimage: "/certificates/oscp/media/cover.webp"\ndescription: "Offensive Security"\n---\n\nbody\n';
    fetchMock.mockResolvedValue(textResponse(markdown));

    const result = await fetchCertificate('oscp');

    expect(fetchMock).toHaveBeenCalledWith('/certificates/oscp.md');
    expect(result?.title).toBe('OSCP');
    expect(result?.order).toBe(3);
    expect(result?.content).toBe('\nbody\n');
    expect(result?.slug).toBe('oscp');
  });

  it('fetchProject returns null when the response is not ok', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchProject('missing')).resolves.toBeNull();
  });

  it('fetchCertificate returns null when the response is not ok', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchCertificate('missing')).resolves.toBeNull();
  });
});
