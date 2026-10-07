export type ContentKind = 'writeup' | 'project' | 'certificate';

export interface Frontmatter {
  title: string;
  date: string;
  draft?: boolean;
  description?: string;
  categories?: string[];
  tags?: string[];
  cve?: string; // CVE identifier, moved out of tags into its own key
  image?: string;
  level?: 'Easy' | 'Medium' | 'Hard';
  platform?: string; // Often inferred from folder, but can be explicit
}

// One entry of public/index.json, for any content kind. `kind` is required on
// every entry (the generator forces it, frontmatter cannot override it).
// Kind-specific keys stay optional: `platform` only exists on writeups (the only
// platformed kind), `order` only on certificates, which may also omit `date`.
export interface ContentIndexItem extends Partial<Frontmatter> {
  kind: ContentKind;
  slug: string;
  path: string; // Site path to the .md file
  title: string;
  order?: number; // Certificates only: real integer, unique across certificates
}

// Writeup entries: the generator guarantees title, date and platform.
export interface WriteupIndexItem extends ContentIndexItem {
  date: string;
  platform: string;
}

export interface WriteupContent extends Frontmatter {
  slug: string;
  content: string; // The raw markdown body
}

// A parsed markdown document of any kind (fetchProject / fetchCertificate).
// The shared loader guarantees title and date exactly the way fetchWriteup does.
export interface ContentDoc extends Frontmatter {
  slug: string;
  content: string; // The raw markdown body
  order?: number; // Certificates only
}

export interface PlatformStats {
  id: string;
  name: string;
  count: number;
}

export interface Section {
  id: string;
  title: string;
}

export interface WriteupSummary {
  title: string;
  platform: string;
  hash: string;
  date: string;
  tags: string[];
  icon: string;
}