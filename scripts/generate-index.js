import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FRONTMATTER PARSER ROBUSTO
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) return {};

  const attributes = {};

  match[1].split(/\r?\n/).forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;

    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();

    // quitar comillas
    if (/^["'].*["']$/.test(value)) {
      value = value.slice(1, -1);
    }

    // arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim());
    }

    // boolean auto parse
    if (value === 'true') value = true;
    if (value === 'false') value = false;

    attributes[key] = value;
  });

  return attributes;
}

const WRITEUPS_DIR = path.join(__dirname, '../public/writeups');
const OUTPUT_FILE = path.join(__dirname, '../public/index.json');

const index = [];

if (fs.existsSync(WRITEUPS_DIR)) {
  const platforms = fs.readdirSync(WRITEUPS_DIR);

  platforms.forEach(platform => {
    const platformPath = path.join(WRITEUPS_DIR, platform);

    if (!fs.statSync(platformPath).isDirectory()) return;

    const files = fs.readdirSync(platformPath).filter(f => f.endsWith('.md'));

    files.forEach(file => {
      const filePath = path.join(platformPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      const meta = parseFrontmatter(content);

      // skip drafts reales
      if (meta.draft === true) return;

      index.push({
        ...meta,
        platform,
        slug: file.replace(/\.md$/, ''),
        path: `/writeups/${platform}/${file}`
      });
    });
  });
}

index.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));

console.log(`Generated index.json with ${index.length} writeups.`);
