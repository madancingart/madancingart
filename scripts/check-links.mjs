import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 3100;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function nextStart() {
  const bin = fileURLToPath(
    new URL("../node_modules/next/dist/bin/next", import.meta.url),
  );
  return spawn(process.execPath, [bin, "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

async function waitUntilReady(child) {
  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    log += chunk.toString();
  });

  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (child.exitCode !== null) {
      throw new Error(`next start zakończył się kodem ${child.exitCode}.\n${log}`);
    }
    try {
      const response = await fetch(`${ORIGIN}/sitemap.xml`);
      if (response.ok) {
        return;
      }
    } catch {
      // serwer jeszcze nie słucha
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Serwer na porcie ${PORT} nie wstał.\n${log}`);
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function toLocalPath(value) {
  const url = new URL(value, ORIGIN);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function hrefsFromHtml(html) {
  const found = [];
  const pattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1].replaceAll("&amp;", "&");
    if (!raw.startsWith("/") || raw.startsWith("//")) {
      continue;
    }
    const path = toLocalPath(raw);
    if (path) {
      found.push(path);
    }
  }
  return found;
}

async function fetchStatus(path) {
  try {
    const response = await fetch(`${ORIGIN}${path}`, { redirect: "follow" });
    return response.status;
  } catch {
    return 0;
  }
}

async function main() {
  const child = nextStart();
  const failures = [];

  try {
    await waitUntilReady(child);
    const sitemapResponse = await fetch(`${ORIGIN}/sitemap.xml`);
    if (!sitemapResponse.ok) {
      throw new Error(`sitemap.xml → status ${sitemapResponse.status}`);
    }
    const xml = await sitemapResponse.text();
    const pages = [
      ...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g),
    ].map((match) => toLocalPath(decodeXml(match[1].trim())));

    const uniquePages = [...new Set(pages.filter(Boolean))];
    if (uniquePages.length === 0) {
      throw new Error("sitemap.xml nie zawiera adresów.");
    }

    const statusByPath = new Map();
    const sourcesByPath = new Map();

    function remember(target, source) {
      const sources = sourcesByPath.get(target) ?? new Set();
      sources.add(source);
      sourcesByPath.set(target, sources);
    }

    for (const page of uniquePages) {
      const response = await fetch(`${ORIGIN}${page}`, { redirect: "follow" });
      statusByPath.set(page, response.status);
      remember(page, "sitemap.xml");
      if (!response.ok) {
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("html")) {
        continue;
      }
      const html = await response.text();
      for (const href of hrefsFromHtml(html)) {
        remember(href, page);
      }
    }

    for (const path of sourcesByPath.keys()) {
      if (statusByPath.has(path)) {
        continue;
      }
      statusByPath.set(path, await fetchStatus(path));
    }

    for (const [path, status] of statusByPath) {
      if (status > 0 && status < 400) {
        continue;
      }
      const sources = sourcesByPath.get(path) ?? new Set(["sitemap.xml"]);
      for (const source of sources) {
        failures.push(`${source} → ${path}`);
      }
    }
  } finally {
    child.kill("SIGTERM");
  }

  if (failures.length > 0) {
    for (const line of failures) {
      console.error(line);
    }
    process.exit(1);
  }

  console.log(`OK — sprawdzone linki bez statusu ≥ 400.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
