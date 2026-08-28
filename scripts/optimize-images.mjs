#!/usr/bin/env node
/**
 * Optymalizuje zdjęcia z images-src/ do src/assets/<podkatalog>.
 *
 *   node scripts/optimize-images.mjs gallery/turnieje
 *   npm run images -- gallery/turnieje
 *
 * Wejście: pliki bezpośrednio w images-src/ (jpg, jpeg, png, webp, tiff, heic).
 * Wyjście: JPEG, max 2560 px dłuższego boku (bez powiększania), quality 82, mozjpeg, bez EXIF.
 * Nazwa: kebab-case, małe litery, rozszerzenie .jpg.
 */
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
]);

const MAX_EDGE = 2560;
const JPEG_QUALITY = 82;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(repoRoot, "images-src");
const assetsRoot = path.join(repoRoot, "src", "assets");

function toKebabJpgName(filename) {
  const base = path.basename(filename, path.extname(filename));
  const kebab = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!kebab) {
    throw new Error(`Nie udało się zbudować nazwy pliku z: ${filename}`);
  }

  return `${kebab}.jpg`;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSaved(before, after) {
  if (before <= 0) {
    return "0%";
  }

  const ratio = ((before - after) / before) * 100;
  const sign = ratio >= 0 ? "−" : "+";
  return `${sign}${Math.abs(ratio).toFixed(0)}%`;
}

function resolveDestDir(destArg) {
  if (!destArg || destArg.startsWith("-")) {
    return null;
  }

  const destDir = path.resolve(assetsRoot, destArg);
  const relative = path.relative(assetsRoot, destDir);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Nieprawidłowy katalog docelowy: ${destArg}`);
  }

  return destDir;
}

async function listSourceImages() {
  let entries;

  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return entries.filter((entry) => {
    if (!entry.isFile()) {
      return false;
    }

    const ext = path.extname(entry.name).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });
}

async function optimizeFile(sourcePath, destPath) {
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(destPath);

  return (await stat(destPath)).size;
}

async function main() {
  const destArg = process.argv[2];
  const destDir = resolveDestDir(destArg);

  if (!destDir) {
    console.error(
      "Użycie: node scripts/optimize-images.mjs <podkatalog-docelowy>\n" +
        "Przykład: npm run images -- gallery/turnieje",
    );
    process.exit(1);
  }

  const files = await listSourceImages();

  if (files.length === 0) {
    console.error(`Brak zdjęć w ${path.relative(repoRoot, sourceDir)}/`);
    process.exit(1);
  }

  await mkdir(destDir, { recursive: true });

  console.log(
    `Źródło: ${path.relative(repoRoot, sourceDir)}/ → ${path.relative(repoRoot, destDir)}/`,
  );

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file.name);
    const destName = toKebabJpgName(file.name);
    const destPath = path.join(destDir, destName);
    const before = (await stat(sourcePath)).size;

    try {
      const after = await optimizeFile(sourcePath, destPath);
      totalBefore += before;
      totalAfter += after;
      console.log(
        `${destName}  ${formatBytes(before)} → ${formatBytes(after)}  (${formatSaved(before, after)})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Pominięto ${file.name}: ${message}`);
    }
  }

  console.log(
    `Razem: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (${formatSaved(totalBefore, totalAfter)})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
