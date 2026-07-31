# Stage 1: build the Angular production bundle (browser + SSR server) and
# the generated sitemap.xml/robots.txt (scripts/generate-sitemap.mjs).
# SSR_API_URL must point to a backend reachable from wherever this image is
# built (not the compose network's "backend" hostname, which only resolves
# at container-run time) — used here for Home's small build-time prerender
# fetch and for enumerating the full destination list for the sitemap.
# Destination pages themselves are SSR'd per request, not prerendered here —
# see context/features/seo-ssr-foundation-spec.md. Missing/unreachable falls
# back gracefully (Home's category lists empty, smaller sitemap) rather than
# failing the build.
FROM node:20-alpine AS builder

ARG SITE_URL=https://www.activswitzerland.com
ARG SSR_API_URL=http://localhost:3000
ARG SITEMAP_HITS_PER_PAGE=100
ENV SITE_URL=$SITE_URL
ENV SSR_API_URL=$SSR_API_URL
ENV SITEMAP_HITS_PER_PAGE=$SITEMAP_HITS_PER_PAGE

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production && node scripts/generate-sitemap.mjs


# Stage 2 ("frontend" target): nginx serving the static/prerendered output,
# proxying anything else to the "frontend-ssr" target below.
FROM nginx:1.27-alpine AS frontend

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


# Stage 3 ("frontend-ssr" target): the Angular SSR Node server. Needs both
# the server bundle and the browser output (server.ts serves static assets
# itself as well as rendering). Production-only install here rather than
# reusing the builder's node_modules, which also carries the Angular CLI
# build toolchain — unneeded (and large) at runtime.
#
# SSR_API_URL is NOT baked in here as a build ARG — destinations,
# destinations/:id, explore-trips, and search all render live per request
# now, so this container needs the *runtime* backend address
# (http://backend:3000, the compose service name), which is a different
# value than whatever reached the backend at build time. Supplied via
# docker-compose.prod.yml's environment: for this service.
FROM node:20-alpine AS frontend-ssr

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/frontend ./dist/frontend

EXPOSE 4000

CMD ["node", "dist/frontend/server/server.mjs"]
