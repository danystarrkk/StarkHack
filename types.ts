export interface Frontmatter {
  title: string;
  date: string;
  draft?: boolean;
  description?: string;
  categories?: string[];
  tags?: string[];
  image?: string;
  level?: 'Easy' | 'Medium' | 'Hard';
  platform?: string; // Often inferred from folder, but can be explicit
}

export interface WriteupIndexItem extends Frontmatter {
  slug: string;
  platform: string;
  path: string; // Relative path to .md file
}

export interface WriteupContent extends Frontmatter {
  slug: string;
  content: string; // The raw markdown body
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