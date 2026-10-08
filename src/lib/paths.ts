// URL builders for the route table. One source of truth so navigation call
// sites (Navbar, Home, list screens, detail back-links, legacy redirects)
// cannot drift apart.

// Real detail URLs (old detail URL shape preserved: /writeups/:platformId/:slug).
export const writeupDetailPath = (platformId: string, slug: string): string =>
  `/writeups/${encodeURIComponent(platformId)}/${encodeURIComponent(slug)}`;

export const projectDetailPath = (slug: string): string =>
  `/projects/${encodeURIComponent(slug)}`;

// Legacy /machines/:platformId redirect target: the platform filter travels as
// the query parameter the route table fixed (?plataforma=).
export const writeupsFilterPath = (platformId: string): string =>
  `/writeups?plataforma=${encodeURIComponent(platformId)}`;
