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

        let data;
        try {
          ({ data } = parseFrontmatter(content));
        } catch (error) {
          // Re-lanzamos con el path: sin contexto no se sabe qué archivo rompe el índice
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to parse ${filePath}: ${reason}`);
        }

        // skip drafts reales (antes de validar: un draft sin publicar no necesita metadata)
        if (data.draft === true) return;

        // Todo writeup publicado necesita título y fecha; sin ellos la entrada llega vacía a la UI
        const missing = ["title", "date"].filter((field) => {
          const value = data[field];
          return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
        });
        if (missing.length > 0) {
          throw new Error(
            `Missing required frontmatter field(s) in ${filePath}: ${missing.join(", ")}`
          );
        }

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
// runCli queda exportada para poder ejercitar el camino de error sin tocar public/
export function runCli(writeupsDir = WRITEUPS_DIR, outputFile = OUTPUT_FILE) {
  try {
    const index = generateIndex(writeupsDir);

    fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));

    console.log(`Generated index.json with ${index.length} writeups.`);
  } catch (error) {
    // Fallo limpio: una sola línea en stderr y exit 1, sin stack trace
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
