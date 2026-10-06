import { parseFrontmatter } from './frontmatter.js';
import { WriteupIndexItem, WriteupContent, PlatformStats } from '../types';

const INDEX_URL = '/index.json';

// Fetch the full index
export const fetchIndex = async (): Promise<WriteupIndexItem[]> => {
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) {
      console.error("Index not found. Did you run 'node scripts/generate-index.js'?");
      return [];
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch writeup index:", error);
    return [];
  }
};

// Get list of platforms from the index
export const getPlatforms = async (): Promise<PlatformStats[]> => {
  const index = await fetchIndex();
  const platforms: Record<string, number> = {};

  index.forEach(item => {
    const p = item.platform.toLowerCase();
    platforms[p] = (platforms[p] || 0) + 1;
  });

  return Object.entries(platforms).map(([name, count]) => ({
    id: name,
    name: name, // Capitalization could be improved here or in CSS
    count
  }));
};

// Get machines for a specific platform
export const getMachinesByPlatform = async (platformId: string): Promise<WriteupIndexItem[]> => {
  const index = await fetchIndex();
  return index.filter(item => item.platform.toLowerCase() === platformId.toLowerCase());
};

// Get the N most recent writeups regardless of platform
export const getRecentWriteups = async (limit: number = 3): Promise<WriteupIndexItem[]> => {
  const index = await fetchIndex();
  // Ensure sorting by date descending just in case index.json isn't perfectly sorted
  const sorted = index.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  return sorted.slice(0, limit);
};

// Fetch and parse a specific markdown file
export const fetchWriteup = async (platform: string, slug: string): Promise<WriteupContent | null> => {
  const path = `/writeups/${platform}/${slug}.md`;
  
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("File not found");
    const text = await response.text();
    
    // Parse Frontmatter with the shared implementation (lib/frontmatter.js).
    // The generic narrows `data` to the writeup shape without asserting: when
    // there is no frontmatter block the parser returns the raw text untouched
    // and empty data, so both cases share the construction below.
    const { data, content } = parseFrontmatter<Partial<WriteupContent>>(text);

    return {
      // El spread va primero: lo que el frontmatter aporte llena el resto,
      // pero slug y content se declaran después para que una clave `slug:` o
      // `content:` escrita en el YAML no pueda pisar el id ni el cuerpo real.
      ...data,
      slug,
      content,
      // Required metadata is guaranteed on every path: fall back to the slug
      // and to today's date when the frontmatter leaves either field unset.
      title: data.title ?? slug,
      date: data.date ?? new Date().toISOString().split('T')[0],
      platform // Ensure platform is consistent
    };

  } catch (error) {
    console.error(`Error fetching writeup ${path}:`, error);
    return null;
  }
};