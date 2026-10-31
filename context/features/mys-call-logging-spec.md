# MySwitzerland Call Logging

## Overview

The MySwitzerland quota still runs out, even though Cloudflare shows only ~1.8k requests/day reaching the origin and real user traffic is very low. Cloudflare can't export the traffic it let through, so the origin now logs it: one line per MySwitzerland call (each one uses quota), tagged with the visitor that caused it, plus a real-visitor nginx access log.

---

## 1. MySwitzerland call log — backend

- `backend/src/middleware/visitorContext.js`: an `AsyncLocalStorage` request context, mounted first in `server.js`.
  - Request came through Cloudflare (`cf-connecting-ip` present): `via: "api"`, visitor from `cf-connecting-ip`, `cf-ipcountry`, `x-cf-asn`, `user-agent`.
  - Request came from the SSR server (no Cloudflare headers): `via: "ssr"`, visitor from the `x-visitor-*` headers the SSR interceptor sends. These are ignored whenever Cloudflare headers are present, so clients can't fake them through Cloudflare.
  - No headers at all: `via: "internal"`. Calls outside any request: `via: "background"`.
- `backend/src/utils/mysCallLog.js`: global axios interceptors, installed at startup. Every call to `MYS_ENDPOINT` writes one JSON line: `{"type":"mys_call", t, status, ms, call, via, ip, country, asn, ua, page, route, msg}`. This covers the page/API controllers and the AI assistant, since both use the global axios. `msg` holds the upstream error message (e.g. `Limit Exceeded` = quota used up, `Too Many Requests` = rate limit). The API key is in a header and is never logged.

## 2. SSR interceptor — `frontend/src/app/core/interceptors/ssr-base-url.interceptor.ts`

During SSR, the interceptor passes the page request's `cf-connecting-ip`, `cf-ipcountry`, `x-cf-asn` and `user-agent` to the backend as `x-visitor-ip/country/asn/ua`, plus `x-visitor-page` (the page path). It reads them via Angular's `REQUEST` token. The token is empty at build-time prerender, so nothing is sent then.

## 3. nginx access log — `frontend/nginx.conf`

`log_format visitor`: ISO time, `CF-Connecting-IP`, `CF-IPCountry`, `asn=`, request, status, bytes, request time, referer, user agent. Before this change the access log recorded the tunnel container's IP for every request.

## 4. Log rotation — `infra/docker-compose.prod.yml`

`x-logging` anchor (json-file, 10 MB × 5) on `backend`, `frontend-ssr` and `frontend`. Docker's default never rotates, and these logs now contain visitor IPs.

## 5. Optional Cloudflare Transform Rule (dashboard)

Rules → Transform Rules → Modify Request Header → Set dynamic: header `x-cf-asn`, value `to_string(ip.src.asnum)`, applied to all requests. Fills the `asn` field in both logs. Without it, the logs still have the IP and country.

---

## Reading the logs

```
# Quota use summary (Node runs inside the container)
docker logs --since 24h activswitzerland_backend 2>&1 \
  | docker exec -i activswitzerland_backend node src/scripts/mysCallSummary.js

# Raw visitor access log
docker logs --since 24h activswitzerland_frontend
```

The summary groups calls by status/message, `via`, endpoint, hour, ASN, country, IP, user agent and rendered page.

---

## Verification

- `node --check` on all changed/new backend files.
- Isolated test (scratch dir, real axios + express, fake MySwitzerland server): Cloudflare-routed call logged as `api` with Cloudflare details; SSR call logged as `ssr` with page; spoofed `x-visitor-ip` alongside `cf-connecting-ip` ignored; 429 `Limit Exceeded` captured in `msg`; `params` merged into `call`; non-MySwitzerland axios call not logged; API key absent from output; call outside a request logged as `background`; summary script parses the output.
- Frontend `tsc --noEmit -p tsconfig.app.json` clean.
- End-to-end in an isolated Docker stack (locally built backend/frontend/frontend-ssr images, fake MySwitzerland server, nginx on 127.0.0.1:18080, requests carrying simulated Cloudflare headers). Results:
  - nginx starts with the new config and logs the real IP, country and ASN
  - an SSR destination page logs `via: "ssr"` with the visitor's IP/country/ASN/UA and page path
  - a direct `/api` call logs `via: "api"`; a repeat call is a Redis HIT and logs nothing
  - an upstream 429 logs `msg: "Limit Exceeded"`
  - a spoofed `X-Visitor-IP` sent through Cloudflare is ignored
  - the summary script runs inside the backend container
  - log rotation applies (`docker inspect`), and the prod compose file passes `docker compose config`
- Finding: one SSR destination page render makes **2** MySwitzerland calls (the destination and nearby attractions), per language. The attractions query uses the destination's coordinates, so it is stable per destination and cacheable.
