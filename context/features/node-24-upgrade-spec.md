# Node 24 Upgrade (Docker images)

## Overview

Another project on the dev machine requires Node 24, so local Node moves from 20.19.5 to 24. To keep local and production identical, the production images move from `node:20-alpine` to `node:24-alpine`. Node 20 also reached end of life in April 2026, so this is due regardless.

Nothing in the repo pins a Node version besides the Dockerfiles: no `.nvmrc`, no `engines` field, no CI workflows. The backend has only pure-JS dependencies (`bcryptjs`, not `bcrypt`), so no native modules need rebuilding. Angular 21 supports Node 24.

## Confirmed decisions

- **Target: `node:24-alpine`** (floating major tag, matching the existing `node:20-alpine` convention).
- **Production host verified (2026-10-18).** The Synology NAS ran `docker run --rm node:24-alpine node -e "console.log(process.version, process.arch)"` successfully: `v24.22.0 x64`. Kernel, architecture and Docker version are compatible with the image.
- **Rollback = revert the `FROM` lines and rebuild.** Keep the previous `node:20-alpine`-based images tagged on the NAS until the new ones have run cleanly for a while.

## Changes

### Docker
- `infra/docker/backend/Dockerfile` — both `FROM node:20-alpine` lines (builder and runtime stage) → `node:24-alpine`.
- `infra/docker/frontend/Dockerfile` — `FROM node:20-alpine AS builder` and `FROM node:20-alpine AS frontend-ssr` → `node:24-alpine`. The `nginx` stage is unchanged.

### Local
- Reinstall dependencies in `frontend/` and `backend/` after switching Node (`rm -rf node_modules && npm ci`), so nothing stays cached against Node 20. Update `package-lock.json` only if `npm ci` forces it; no dependency bumps are part of this change.

## Verification

- Frontend: `npx ng build --configuration production` succeeds on Node 24; check the existing bundle-size warning is unchanged.
- Backend: existing test suite passes on Node 24.
- Build both images locally, then on the NAS under a different project name or port before touching production.
- SSR smoke test: load a destination page through the SSR container and confirm it renders.
- Backend smoke test against real MongoDB/Redis: login, an AI chat message, a Stripe webhook.
- Then deploy normally and watch container logs for the first day.

## Open questions

- None blocking. A floating `24-alpine` tag can pick up new minor versions on rebuild; pin to a specific `24.x` only if that becomes a problem.

## Non-goals

- Dependency upgrades, Angular/TypeScript version changes, or adding `.nvmrc` / `engines` (could be a follow-up if the local-versus-production mismatch recurs).
- Changing the nginx or database images.
