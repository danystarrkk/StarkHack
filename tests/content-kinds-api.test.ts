import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCertificate,
  fetchIndex,
  fetchIndexByKind,
  fetchProject,
  getCertificateGroups,
  getCertificates,
  getProjectGroups,
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

describe('getProjects(group?) / getProjectGroups() / getCertificateGroups()', () => {
  // Deliberately NOT in canonical order: the group accessors must impose the
  // approved canonical order (PROJECT_GROUPS / CERTIFICATE_GROUPS) themselves,
  // including groups with count 0 so the frontend can render stable sections.
  const groupedIndex: ContentIndexItem[] = [
    {
      kind: 'project',
      title: 'Proj herramientas',
      date: '2026-02-02',
      slug: 'proj-h',
      path: '/projects/proj-h.md',
      image: '/projects/proj-h/media/cover.webp',
      group: 'herramientas',
      tags: ['CLI Utilities'],
    },
    {
      kind: 'project',
      title: 'Proj scripts 1',
      date: '2026-01-01',
      slug: 'proj-s1',
      path: '/projects/proj-s1.md',
      image: '/projects/proj-s1/media/cover.webp',
      group: 'scripts',
      tags: ['Recon'],
    },
    {
      kind: 'certificate',
      title: 'Cert hack4u',
      slug: 'cert-h',
      path: '/certificates/cert-h.md',
      order: 2,
      image: '/certificates/cert-h/media/cover.webp',
      description: 'h',
      group: 'hack4u',
      tags: ['Web Security'],
    },
    {
      kind: 'certificate',
      title: 'Cert hack4u 2',
      slug: 'cert-h2',
      path: '/certificates/cert-h2.md',
      order: 3,
      image: '/certificates/cert-h2/media/cover.webp',
      description: 'h2',
      group: 'hack4u',
      tags: ['Systems'],
    },
    {
      kind: 'project',
      title: 'Proj scripts 2',
      date: '2026-03-03',
      slug: 'proj-s2',
      path: '/projects/proj-s2.md',
      image: '/projects/proj-s2/media/cover.webp',
      group: 'scripts',
      tags: ['Scanning'],
    },
    {
      kind: 'certificate',
      title: 'Cert universidad',
      slug: 'cert-u',
      path: '/certificates/cert-u.md',
      order: 1,
      image: '/certificates/cert-u/media/cover.webp',
      description: 'u',
      group: 'universidad',
      tags: ['Networking'],
    },
  ];

  it('getProjects(group) filters exactly the projects of that group', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    const scripts = await getProjects('scripts');

    expect(scripts.map((item) => item.slug)).toEqual(['proj-s1', 'proj-s2']);
    expect(scripts.every((item) => item.group === 'scripts')).toBe(true);

    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));
    const herramientas = await getProjects('herramientas');
    expect(herramientas.map((item) => item.slug)).toEqual(['proj-h']);
  });

  it('getProjects(group) returns an empty list for a valid group without projects', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    // 'automatizaciones' is canonical but empty in the fixture.
    await expect(getProjects('automatizaciones')).resolves.toEqual([]);
  });

  it('getProjects() without a group still returns every project', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    const projects = await getProjects();

    expect(projects.map((item) => item.slug)).toEqual(['proj-h', 'proj-s1', 'proj-s2']);
  });

  it('getProjectGroups() returns all 3 canonical groups in order, counts included, zero counted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    const groups = await getProjectGroups();

    expect(groups).toEqual([
      { id: 'scripts', count: 2 },
      { id: 'automatizaciones', count: 0 },
      { id: 'herramientas', count: 1 },
    ]);
  });

  it('getCertificateGroups() returns all 3 canonical groups in order, counts included, zero counted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    const groups = await getCertificateGroups();

    expect(groups).toEqual([
      { id: 'universidad', count: 1 },
      { id: 'hack4u', count: 2 },
      { id: 'cisco', count: 0 },
    ]);
  });

  it('getProjectGroups() counts only projects (never certificates)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(groupedIndex));

    const groups = await getProjectGroups();
    const total = groups.reduce((sum, group) => sum + group.count, 0);

    expect(total).toBe(3); // the two certificates must not be counted
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
