/**
 * This script runs in Node.js environment.
 * It scans 'public/writeups' and generates 'public/index.json'.
 * Usage: node scripts/generate-index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic Frontmatter Parser (Regex based to avoid heavy dependencies in this simple script)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---\n/);
  if (!match) return {};
  
  const yamlBlock = match[1];
  const attributes = {};
  
  yamlBlock.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join(':').trim();
      
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      
      // Handle arrays [a, b]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
      }
      
      attributes[key] = value;
    }
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
    
    if (fs.statSync(platformPath).isDirectory()) {
      const files = fs.readdirSync(platformPath).filter(f => f.endsWith('.md'));
      
      files.forEach(file => {
        const filePath = path.join(platformPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const meta = parseFrontmatter(content);
        
        // Skip drafts
        if (meta.draft === 'true' || meta.draft === true) return;

        index.push({
          ...meta,
          platform: platform,
          slug: file.replace('.md', ''),
          path: `/writeups/${platform}/${file}`
        });
      });
    }
  });
}

// Sort by date desc
index.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
console.log(`Generated index.json with ${index.length} writeups.`);
