# SEO Fix: SSR Silently Falling Back to CSR + Locale-Home Redirects

## Why

Google Search Console shows only ~15 of ~1,400 sitemap URLs indexed (2026-10-02). Live
investigation found two production bugs, both in `frontend/nginx.conf`:

1. **Every SSR route serves an empty CSR shell.** `curl` of any `/:lang/destinations/:id`,
   `/:lang/practical-info/:slug`, or trip page returns `<app-root></app-root>` with the generic
   `index.html` title/description and no canonical — Google sees ~1,400 identical blank pages.
   Only the prerendered locale home pages (`ng-server-context="ssg"`) have real content.
2. **Locale home pages redirect.** `https://www.activswitzerland.com/de` →
   `301 http://www.activswitzerland.com/de/` (note `http`). Canonical, hreflang, and sitemap all
   point at the slash-less `/de`, so Google reports "Page with redirect" for `/de`, `/fr`, `/it`
   and indexes none of them.

## Root causes (verified)

### 1. Untrusted `X-Forwarded-For` → deopt to CSR

`@angular/ssr` 21.2.19, `fesm2022/_validation-chunk.mjs` `sanitizeRequestHeaders()`: any
`x-forwarded-*` header not in `trustProxyHeaders` logs a warning **and sets `deoptToCSR = true`**,
and `AngularAppEngine.handle()` then returns `serverApp.serveClientSidePage()`. Default trusted
set (when unconfigured) is only `x-forwarded-host` + `x-forwarded-proto`.

The `@ssr` location sets `X-Forwarded-For $proxy_add_x_forwarded_for`, so every SSR request
carries it. Production `docker logs activswitzerland_frontend_ssr` is nothing but
`Received "x-forwarded-for" header but "trustProxyHeaders" was not set up to allow it.`
`NG_ALLOWED_HOSTS` is correctly set and is not involved.

### 2. nginx directory redirect

Locale home pages are prerendered to `/<lang>/index.html` directories. `try_files $uri $uri/`
matches the directory for `/de`, and nginx issues its trailing-slash 301 — as an absolute URL
built from the scheme it sees (`http`, since TLS terminates upstream at Cloudflare/DSM).

## Changes (`frontend/nginx.conf` only)

1. `@ssr` block: replace `X-Forwarded-For $proxy_add_x_forwarded_for` with
   `proxy_set_header X-Forwarded-For "";` (empty value = header not sent). This also drops any
   copy added upstream by Cloudflare/DSM. SSR rendering never uses the client IP. Keep
   `X-Forwarded-Proto` (trusted by default). `X-Real-IP` isn't `x-forwarded-*`, so unaffected.
   - Rejected alternative: `NG_TRUST_PROXY_HEADERS=x-forwarded-for,...` in compose — trusts a
     header nothing consumes, and any future upstream-added `x-forwarded-*` header would still
     re-break SSR silently. Stripping at nginx keeps SSR's input under our control.
2. New exact-match location for bare locale paths, serving the prerendered file directly (no
   redirect): `location ~ ^/(en|de|fr|it|es)$ { try_files /$1/index.html @ssr; }`.
   Langs duplicated from `shared/services/lang.ts`'s `SUPPORTED_LANGS` (same as
   `generate-sitemap.mjs`).
3. `absolute_redirect off;` at server level — any remaining nginx-generated redirect becomes
   relative, so it can never downgrade to `http`.

Out of scope: `/de/` (with slash) still serves 200 with canonical `/de` — acceptable, canonical
handles it. Non-www → www 301 is a Cloudflare dashboard rule (user action, not code).

## Verification (after deploy)

- `curl -s https://www.activswitzerland.com/en/destinations/<id> | grep canonical` → prints a
  page-specific canonical; title is the destination's, not "ActivSwitzerland".
- `curl -sI https://www.activswitzerland.com/de` → `200`, no `location`.
- `docker logs activswitzerland_frontend_ssr` → no more `trustProxyHeaders` warnings.
- Search Console: URL Inspection → Test live URL on a destination page; resubmit sitemap.
