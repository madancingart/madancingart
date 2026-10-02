#!/usr/bin/env node
/**
 * Przygotowuje film do strony. Wymaga lokalnego ffmpeg w PATH.
 *
 *   node scripts/video.mjs film.mp4 --name trenerzy --poster-at 8
 *   node scripts/video.mjs film.mp4 --name trenerzy --poster-at 8 --loop-start 18 --loop-duration 6
 *
 * Wynik:
 *   public/videos/<name>.mp4     1080p, H.264 CRF 23, AAC 128k, faststart
 *   public/videos/<name>.webm    VP9 + Opus
 *   src/assets/video/<name>.jpg  poster z podanej sekundy
 *   public/videos/<name>-petla.mp4   opcjonalnie: 720p, bez audio, CRF 28
 */
import { spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YOUTUBE_LIMIT = 25 * 1024 * 1024;
const LOOP_LIMIT = 2.5 * 1024 * 1024;

function usage() {
  console.error(
    "Użycie: node scripts/video.mjs <plik> --name <id> --poster-at <sekundy> [--loop-start <sekundy> --loop-duration <sekundy>]",
  );
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function requireFfmpeg() {
  const check = spawnSync("ffmpeg", ["-hide_banner", "-version"], { encoding: "utf8" });
  if (check.error || check.status !== 0) {
    console.error("Brak ffmpeg. Zainstaluj ffmpeg lokalnie i uruchom skrypt ponownie.");
    process.exit(1);
  }
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || "ffmpeg zakończył się błędem.";
    throw new Error(detail.split("\n").slice(-8).join("\n"));
  }
}

function probeDuration(input) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-i", input], { encoding: "utf8" });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error("Nie udało się odczytać długości filmu.");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function scaleFilter(width, height) {
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
}

function warnIfLarge(label, bytes) {
  if (bytes > YOUTUBE_LIMIT) {
    console.warn(`${label}: ${formatBytes(bytes)} — rozważ YouTube`);
  }
}

async function main() {
  const input = process.argv[2];
  const name = readOption("--name");
  const posterAt = readOption("--poster-at");
  const loopStart = readOption("--loop-start");
  const loopDuration = readOption("--loop-duration");

  if (!input || input.startsWith("-") || !name || posterAt === undefined) {
    usage();
    process.exit(1);
  }

  if ((loopStart === undefined) !== (loopDuration === undefined)) {
    console.error("Pętla wymaga obu opcji: --loop-start i --loop-duration.");
    process.exit(1);
  }

  requireFfmpeg();

  const sourcePath = path.resolve(input);
  const sourceStat = await stat(sourcePath);
  const videoDir = path.join(repoRoot, "public", "videos");
  const posterDir = path.join(repoRoot, "src", "assets", "video");
  await mkdir(videoDir, { recursive: true });
  await mkdir(posterDir, { recursive: true });

  const mp4Path = path.join(videoDir, `${name}.mp4`);
  const webmPath = path.join(videoDir, `${name}.webm`);
  const posterPath = path.join(posterDir, `${name}.jpg`);

  warnIfLarge("Źródło", sourceStat.size);

  console.log(`Koduję ${name}.mp4…`);
  runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-vf",
    scaleFilter(1920, 1080),
    "-c:v",
    "libx264",
    "-crf",
    "23",
    "-preset",
    "medium",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  console.log(`Koduję ${name}.webm…`);
  runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-vf",
    scaleFilter(1920, 1080),
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "32",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
    webmPath,
  ]);

  console.log(`Poster w ${posterAt} s…`);
  runFfmpeg([
    "-y",
    "-ss",
    posterAt,
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    posterPath,
  ]);

  const mp4Size = (await stat(mp4Path)).size;
  const webmSize = (await stat(webmPath)).size;
  warnIfLarge(path.basename(mp4Path), mp4Size);
  warnIfLarge(path.basename(webmPath), webmSize);

  const duration = probeDuration(mp4Path);
  console.log(`Długość: ${duration.toFixed(1)} s`);
  console.log(`${path.basename(mp4Path)}  ${formatBytes(mp4Size)}`);
  console.log(`${path.basename(webmPath)}  ${formatBytes(webmSize)}`);
  console.log(`${path.relative(repoRoot, posterPath)}`);

  if (loopStart !== undefined && loopDuration !== undefined) {
    const loopPath = path.join(videoDir, `${name}-petla.mp4`);
    console.log(`Pętla od ${loopStart} s, ${loopDuration} s…`);
    runFfmpeg([
      "-y",
      "-ss",
      loopStart,
      "-i",
      sourcePath,
      "-t",
      loopDuration,
      "-an",
      "-vf",
      scaleFilter(1280, 720),
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      loopPath,
    ]);
    const loopSize = (await stat(loopPath)).size;
    console.log(`${path.basename(loopPath)}  ${formatBytes(loopSize)}`);
    if (loopSize > LOOP_LIMIT) {
      console.warn(
        `${path.basename(loopPath)}: ${formatBytes(loopSize)} — pętla na stronie głównej może mieć najwyżej 2,5 MB.`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
