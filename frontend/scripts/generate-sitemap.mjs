#!/usr/bin/env node
// Postbuild step (see package.json's "build" script) — writes robots.txt and
// sitemap.xml into the built browser output. Generated rather than static so
// both come from one SITE_URL env var and can never ship with a placeholder
// domain. Destination pages are SSR'd per request rather than prerendered
// (see app.routes.server.ts's comment), so this is the only build step that
// still needs the full destination list — purely to enumerate sitemap URLs,
// unrelated to rendering. Kept as its own fetch rather than importing from
// app code since this script runs outside Angular's build/TS pipeline
// entirely — SUPPORTED_LANGS is duplicated from shared/services/lang.ts for
// the same reason.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'];
const SITE_URL = (process.env.SITE_URL ?? 'https://www.activswitzerland.com').replace(/\/$/, '');
const API_URL = process.env.SSR_API_URL ?? 'http://localhost:3000';
const HITS_PER_PAGE = Number(process.env.SITEMAP_HITS_PER_PAGE ?? 100);
const MAX_PAGES = 20;
const OUT_DIR = join(import.meta.dirname, '..', 'dist', 'frontend', 'browser');

async function getDestinationIds() {
  const ids = new Set();

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API_URL}/api/v1/myswitzerland/destinations`
      + `?language=en&page=${page}&hitsPerPage=${HITS_PER_PAGE}&facets=&expand=false&translate=true&stripHtml=true&top=false`;

    let json;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err) {
      console.error(`[sitemap] Failed to fetch destinations page ${page} from ${API_URL}: ${err.message}. Falling back to ${ids.size} destination(s) collected so far.`);
      break;
    }

    const hits = json.data?.data ?? [];
    hits.forEach(d => { if (d.identifier) ids.add(d.identifier); });

    const totalPages = json.data?.meta?.page?.totalPages ?? 1;
    if (page + 1 >= totalPages || hits.length === 0) break;
  }

  if (ids.size === 0) {
    console.warn(`[sitemap] No destination ids resolved — sitemap.xml will only list the static pages. Set SSR_API_URL if the backend is not reachable at ${API_URL}.`);
  }

  return Array.from(ids);
}

function buildSitemap(destinationIds) {
  const staticPaths = ['', '/destinations'];
  const paths = [...staticPaths, ...destinationIds.map(id => `/destinations/${id}`)];
  const urls = SUPPORTED_LANGS.flatMap(lang => paths.map(path => `/${lang}${path}`));
  const entries = urls
    .map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobots() {
  // Every real path now sits under a /en|de|fr|it prefix, so a bare
  // `Disallow: /trip-planner` (which only matches paths starting with that
  // exact string) would no longer match anything — one line per locale
  // instead of relying on non-standard wildcard support.
  const disallowPaths = ['/trip-planner', '/auth'];
  const disallowLines = SUPPORTED_LANGS.flatMap(lang => disallowPaths.map(p => `Disallow: /${lang}${p}`));
  return [
    'User-agent: *',
    'Allow: /',
    ...disallowLines,
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

const destinationIds = await getDestinationIds();
await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'sitemap.xml'), buildSitemap(destinationIds), 'utf8');
await writeFile(join(OUT_DIR, 'robots.txt'), buildRobots(), 'utf8');
console.log(`[sitemap] Wrote sitemap.xml (${destinationIds.length} destination(s)) and robots.txt to ${OUT_DIR}`);
