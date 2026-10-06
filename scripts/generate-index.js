import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseFrontmatter } from "../lib/frontmatter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WRITEUPS_DIR = path.join(__dirname, "../public/writeups");
const OUTPUT_FILE = path.join(__dirname, "../public/index.json");

// Recorre writeupsDir por plataforma y devuelve el array índice de writeups
export function generateIndex(writeupsDir) {
  const index = [];

  if (fs.existsSync(writeupsDir)) {
    const platforms = fs.readdirSync(writeupsDir);

    platforms.forEach((platform) => {
      const platformPath = path.join(writeupsDir, platform);

      if (!fs.statSync(platformPath).isDirectory()) return;

      const files = fs.readdirSync(platformPath).filter((f) => f.endsWith(".md"));

      files.forEach((file) => {
        const filePath = path.join(platformPath, file);
        const content = fs.readFileSync(filePath, "utf8");

        const { data } = parseFrontmatter(content);

        // skip drafts reales
        if (data.draft === true) return;

        index.push({
          ...data,
          platform,
          slug: file.replace(/\.md$/, ""),
          path: `/writeups/${platform}/${file}`,
        });
      });
    });
  }

  index.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return index;
}

// CLI: node scripts/generate-index.js → escribe public/index.json
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = generateIndex(WRITEUPS_DIR);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));

  console.log(`Generated index.json with ${index.length} writeups.`);
}
