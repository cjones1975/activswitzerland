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

async function getTripSlugs() {
  const slugs = [];
  let skip = 0;
  const limit = 50; // matches the API's own cap (backend/src/controllers/trips.js's getPublicTrips)

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API_URL}/api/v1/trips/public?skip=${skip}&limit=${limit}`;

    let json;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err) {
      console.error(`[sitemap] Failed to fetch public trips (skip=${skip}) from ${API_URL}: ${err.message}. Falling back to ${slugs.length} trip(s) collected so far.`);
      break;
    }

    const hits = json.data ?? [];
    hits.forEach(t => { if (t.slug) slugs.push(t.slug); });

    skip += hits.length;
    if (!json.hasMore || hits.length === 0) break;
  }

  return slugs;
}

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

function buildSitemap(destinationIds, tripSlugs) {
  // lastmod is only meaningful for the two static pages (a build genuinely just happened).
  // Destination-detail pages get no lastmod at all — the MySwitzerland API exposes no
  // per-destination modification date, and a faked/always-fresh value is worse than none:
  // it trains crawlers to stop trusting the field site-wide (Google's own guidance).
  // Same reasoning applies to trip pages — no per-trip modification date is tracked either.
  const buildDate = new Date().toISOString().slice(0, 10);
  const pages = [
    { path: '', priority: '1.0', lastmod: buildDate },
    { path: '/destinations', priority: '0.8', lastmod: buildDate },
    ...destinationIds.map(id => ({ path: `/destinations/${id}`, priority: '0.6' })),
    ...tripSlugs.map(slug => ({ path: `/trips/${slug}`, priority: '0.6' })),
  ];
  const entries = SUPPORTED_LANGS.flatMap(lang => pages.map(({ path, priority, lastmod }) => {
    const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
    return `  <url><loc>${SITE_URL}/${lang}${path}</loc>${lastmodTag}<priority>${priority}</priority></url>`;
  })).join('\n');
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

const [destinationIds, tripSlugs] = await Promise.all([getDestinationIds(), getTripSlugs()]);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'sitemap.xml'), buildSitemap(destinationIds, tripSlugs), 'utf8');
await writeFile(join(OUT_DIR, 'robots.txt'), buildRobots(), 'utf8');
console.log(`[sitemap] Wrote sitemap.xml (${destinationIds.length} destination(s), ${tripSlugs.length} trip(s)) and robots.txt to ${OUT_DIR}`);
