# Deployment Plan: Synology DS723+ via Docker

**Status:** Planned — not yet implemented. Implement when the app is ready to go live.

## Context

The app (Angular frontend + Express/Mongo/Redis backend) is nearing completion and needs a repeatable path to production on the user's DS723+ NAS. The router already forwards 80/443 to the NAS. An `infra/` folder already exists with a **dev-oriented** `docker-compose.yml` (mongodb + mongo-express + redis + backend, ports published directly to the host) and a backend `Dockerfile`, but there is no frontend container, no production compose file, and no reverse-proxy/TLS setup.

Decisions already confirmed with the user:
- **TLS**: terminate at DSM's built-in reverse proxy + Let's Encrypt certificate (no cert handling inside containers).
- **Update workflow**: build & tag images on the dev machine, push to GitHub Container Registry (repo is `github.com/cjones1975/activswitzerland`), NAS pulls the tagged images — keeps the 2-core NAS CPU out of the Angular build path and gives clean rollback via image tags.
- **Domain**: `activswitzerland.com` — registered on name.com, DNS already pointed at the home public IP (the existing `cjones.synology.me` entry in `backend/src/middleware/cors.js`'s dev whitelist is a leftover from earlier local testing and will be replaced, not reused).

Goal: a `docker compose up -d` on the NAS that runs the full stack, with a simple, repeatable "test locally → push → pull on NAS" update loop and easy rollback.

## Architecture

```
Internet ──443/80──▶ Router (existing port-forward) ──▶ NAS
                                                           │
                                            DSM Control Panel Reverse Proxy
                                            (activswitzerland.com, Let's Encrypt cert, auto-renew)
                                                           │
                                                           ▼
                                        frontend container (nginx:alpine, port 8080→80)
                                        - serves Angular static build
                                        - proxies /api/* to backend:3000 (docker network)
                                                           │
                                                  docker network "app_network"
                                                           │
                                        backend container (node:20-alpine, NOT published to host)
                                            │                       │
                                        mongodb (bind-mounted data)   redis
```

Only the **frontend** container's port is published to the host (e.g. `127.0.0.1:8080:80` or a NAS-LAN-only bind); DSM's reverse proxy forwards to it. Backend, mongo, and redis stay on the internal docker network only — no direct internet exposure, no CORS issue for API calls (browser calls are same-origin through nginx).

## Changes

### 1. `frontend/Dockerfile` (new) — multi-stage static build
- Stage 1: `node:20-alpine`, `npm ci`, `npm run build` (production config, outputs to `dist/frontend/browser`).
- Stage 2: `nginx:1.27-alpine`, copy build output to `/usr/share/nginx/html`, copy a custom `nginx.conf`.
- `.dockerignore` excluding `node_modules`, `dist`, `.angular`.

### 2. `frontend/infra/nginx.conf` (or `infra/docker/frontend/nginx.conf`) (new)
- SPA fallback: `try_files $uri $uri/ /index.html;`
- `location /api/ { proxy_pass http://backend:3000; proxy_set_header Host/X-Real-IP/X-Forwarded-For/X-Forwarded-Proto ... }` — matches the existing `environment.prod.ts` comment ("same-origin: proxy /api/ to the backend").
- gzip on, long cache headers (`immutable`) for hashed static assets (`outputHashing: all` is already set in `angular.json`).

### 3. `backend/src/middleware/cors.js` — update production whitelist
Replace the stale dev entries with the real production origin:
```js
const whitelist = ['https://activswitzerland.com', 'https://www.activswitzerland.com'];
```
(Same-origin browser requests won't even need this in practice since nginx proxies server-side, but the `Origin` header from the browser will still be checked by `cors()`, so it must match exactly, including scheme.)

### 4. `infra/docker-compose.prod.yml` (new) — production stack
- `frontend`: `image: ghcr.io/cjones1975/activswitzerland-frontend:${IMAGE_TAG}`, `ports: - "8080:80"` (bind to NAS LAN or `127.0.0.1` depending on whether DSM reverse proxy runs on the same host — it does, so `127.0.0.1:8080:80` is safest).
- `backend`: `image: ghcr.io/cjones1975/activswitzerland-backend:${IMAGE_TAG}`, **no `ports:` published** (only reachable via the docker network).
- `mongodb`: no published port; data volume bind-mounted to a real NAS path (e.g. `/volume1/docker/activswitzerland/mongodb:/data/db`) instead of an anonymous docker volume, so Synology Hyper Backup / snapshots can cover it.
- `redis`: no published port.
- Drop `mongo-express` from the default stack entirely (a full DB admin UI has no business facing the internet). Keep it in the existing dev `docker-compose.yml` only; if the user ever needs it in prod, it can be run ad hoc with `docker compose --profile debug up mongo-express` bound to `127.0.0.1` only.
- All services keep `restart: unless-stopped` and the existing healthchecks.

### 5. `infra/.env.prod` (created directly on the NAS, never committed)
Same shape as the existing `infra/.env` but with:
- A freshly generated `JWT_SECRET` (don't reuse the dev one).
- `NODE_ENV=production`.
- `IMAGE_TAG=` (set by the update script, see below).
Confirm `.gitignore` already covers `.env*` (it does — verified).

### 6. Build/push script — `infra/build-and-push.ps1` (new, run from dev machine)
- Computes a tag from the short git SHA (`git rev-parse --short HEAD`).
- `docker build -t ghcr.io/cjones1975/activswitzerland-frontend:$tag -f frontend/Dockerfile frontend`
- `docker build -t ghcr.io/cjones1975/activswitzerland-backend:$tag -f infra/docker/backend/Dockerfile backend`
- Also tags/pushes `:latest` for convenience, but the NAS pins to the SHA tag via `.env.prod`, not `latest`, so rollback = editing one variable.
- `docker push` both tags for both images (requires `docker login ghcr.io` once, using a GitHub PAT with `write:packages`).

### 7. NAS-side update script — `infra/update.sh` (new, lives on the NAS, run over SSH or as a DSM Task Scheduler script)
```sh
cd /volume1/docker/activswitzerland/infra
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
docker image prune -f
```
Rollback = edit `IMAGE_TAG` in `.env.prod` to a previous SHA, re-run the script.

### 8. DSM configuration (manual, no repo files — documented as steps in the plan, not automated)
0. On name.com, confirm both `activswitzerland.com` and `www.activswitzerland.com` resolve to the home public IP (an A record for the apex plus either a second A record or a CNAME for `www`) — needed so the HTTP-01 challenge and the reverse-proxy rule both work for either hostname.
1. Control Panel → Security → Certificate → add a Let's Encrypt cert for `activswitzerland.com` (add `www.activswitzerland.com` as a SAN on the same cert), set it as the used-by cert for the reverse proxy rule. Renewal is automatic.
2. Control Panel → Login Portal → Advanced → Reverse Proxy: create a rule `https://activswitzerland.com:443` (and one for the `www` host, or a single rule if DSM's version supports multiple hostnames per rule) → `http://localhost:8080` (or the NAS LAN IP if binding wasn't `127.0.0.1`), WebSocket support enabled (harmless even if unused today).
3. Confirm DSM itself isn't also trying to bind 80/443 for its own login portal on the same interface (Control Panel → Network → DSM Settings, move DSM's HTTP/HTTPS ports off 80/443 if needed, since the router forwards those to whatever is listening on the NAS on those ports).

### 9. One-time NAS setup
- Create `/volume1/docker/activswitzerland/{infra,mongodb-data}` (or via File Station).
- Copy `infra/docker-compose.prod.yml`, `infra/update.sh` to the NAS (e.g. via `git clone` of just the infra folder, rsync, or Synology File Station upload — the NAS does **not** need the frontend/backend source, only the compose file + env, since it pulls prebuilt images).
- `docker login ghcr.io` once with a read-only PAT (`read:packages`) so `docker compose pull` can authenticate against the private GHCR images.
- Import the project into Container Manager (Container Manager → Project → Create → point at the compose file) so it's also visible/controllable from the DSM GUI, or just run `update.sh` over SSH — both operate on the same compose file.

## Verification
1. **Local**: `docker build` both images locally, `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d` on the dev machine (with `IMAGE_TAG` pointing at a locally-built tag) and confirm the app loads at `http://localhost:8080`, login/API calls work, and static assets are served with cache headers.
2. **Push**: run `build-and-push.ps1`, confirm both tags show up in the repo's GHCR packages on GitHub.
3. **NAS**: run `update.sh` on the NAS, `docker compose ps` shows all 4 services healthy, `docker compose logs backend` shows `Server running in production mode` and `Redis Connected`/Mongo connected without errors.
4. **End-to-end**: from an external network (e.g. phone on mobile data), hit `https://activswitzerland.com`, verify the cert is valid (Let's Encrypt, not self-signed), the app loads, and a login/API-backed page works (confirms the nginx `/api/` proxy and CORS whitelist are correct).
5. **Rollback check**: change `IMAGE_TAG` in `.env.prod` to the previous SHA, re-run `update.sh`, confirm the previous version comes back up.
