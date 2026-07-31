import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';

// environment.apiUrl is '' in production so the browser calls same-origin
// paths that nginx proxies to the backend. Server-side (both Home's
// build-time prerender and every route rendered live via RenderMode.Server —
// destinations, destinations/:id, explore-trips, search) there's no browser
// origin to resolve a relative URL against, so these requests need an
// explicit absolute origin instead. SSR_API_URL is read here both at build
// time (Docker build ARG, see infra/docker/frontend/Dockerfile) and at
// container runtime (docker-compose env, pointing at the "backend" service
// name — see infra/docker-compose.prod.yml) — same variable, naturally
// different values for each context. scripts/generate-sitemap.mjs reads the
// same variable independently for its own (unrelated to rendering) sitemap
// URL list. See context/features/seo-ssr-foundation-spec.md.
export const ssrBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  if (isBrowser || !req.url.startsWith('/')) return next(req);

  const apiUrl = process.env['SSR_API_URL'] ?? 'http://localhost:3000';
  return next(req.clone({ url: `${apiUrl}${req.url}` }));
};
