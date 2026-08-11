import { RenderMode, ServerRoute } from '@angular/ssr';
import { SUPPORTED_LANGS } from './shared/services/lang';

export const serverRoutes: ServerRoute[] = [
  // Single static page, low fetch volume (a few category preview lists) —
  // safe to prerender once at build time, now once per locale.
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return SUPPORTED_LANGS.map(lang => ({ lang }));
    },
  },
  // Destination content comes from a third-party API (MySwitzerland) that
  // can change or remove entries independently of our own deploys, and
  // prerendering all destinations at build time meant firing ~945 data
  // fetches at once, which reliably hit that API's rate limit. SSR per
  // request instead: freshness is bounded by the backend's 24h Redis cache
  // rather than "until the next full rebuild", a failed fetch is just that
  // one request (self-heals on the next visit) rather than permanently
  // baked into a static file, and real traffic to these pages is naturally
  // spread out rather than arriving as a synchronized build-time burst. See
  // context/features/seo-ssr-foundation-spec.md.
  { path: ':lang/destinations', renderMode: RenderMode.Server },
  { path: ':lang/destinations/:id', renderMode: RenderMode.Server },
  { path: ':lang/explore-trips', renderMode: RenderMode.Server },
  { path: ':lang/trips/:slug', renderMode: RenderMode.Server },
  { path: ':lang/search', renderMode: RenderMode.Server },
  // Personal/authenticated content, not canonical — client-render only, no
  // SSR/prerender spent here (see the spec's Confirmed decisions).
  { path: ':lang/trip-planner/**', renderMode: RenderMode.Client },
  { path: ':lang/auth/**', renderMode: RenderMode.Client },
  // Covers the bare-path redirect (any URL with no/garbage locale prefix).
  { path: '**', renderMode: RenderMode.Server },
];
