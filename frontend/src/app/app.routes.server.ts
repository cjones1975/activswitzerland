import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Single static page, low fetch volume (a few category preview lists) —
  // safe to prerender once at build time.
  { path: '', renderMode: RenderMode.Prerender },
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
  { path: 'destinations', renderMode: RenderMode.Server },
  { path: 'destinations/:id', renderMode: RenderMode.Server },
  { path: 'explore-trips', renderMode: RenderMode.Server },
  { path: 'search', renderMode: RenderMode.Server },
  // Personal/authenticated content, not canonical — client-render only, no
  // SSR/prerender spent here (see the spec's Confirmed decisions).
  { path: 'trip-planner/**', renderMode: RenderMode.Client },
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
