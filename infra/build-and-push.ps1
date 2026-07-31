# Build and push production images to GitHub Container Registry.
# Run from the repo root after you've tested your changes locally.
#
# Usage: .\infra\build-and-push.ps1
# Requires: `docker login ghcr.io` already done once with a PAT that has write:packages.
#
# SITE_URL / SSR_API_URL (env vars, optional): baked into the frontend
# image at build time — SITE_URL is the real production domain (used in the
# generated sitemap.xml/robots.txt), SSR_API_URL must be a backend reachable
# from THIS machine (not the "backend" compose hostname, which only resolves
# inside the deployed containers' network) so Home's build-time prerender
# and the sitemap's destination list actually resolve. Left unset, the build
# still succeeds with placeholder/localhost defaults — see
# context/features/seo-ssr-foundation-spec.md. Note this is a *build-time*
# value only; the deployed frontend-ssr container gets its own SSR_API_URL
# at runtime from docker-compose.prod.yml (pointing at the "backend" service
# name instead), since destinations/explore-trips/search render live.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tag = (git rev-parse --short HEAD).Trim()
$registry = "ghcr.io/cjones1975"

if ((git status --porcelain) -ne $null) {
    Write-Warning "Working tree has uncommitted changes. The pushed image won't exactly match a committed commit."
}

if (-not $env:SITE_URL -or -not $env:SSR_API_URL) {
    Write-Warning "SITE_URL and/or SSR_API_URL not set — frontend build will use placeholder/localhost defaults (sitemap URLs and/or Home's category previews will be incomplete)."
}

Write-Host "Building backend image ($registry/activswitzerland-backend:$tag)..." -ForegroundColor Cyan
docker build -t "$registry/activswitzerland-backend:$tag" -t "$registry/activswitzerland-backend:latest" `
    -f "$repoRoot/infra/docker/backend/Dockerfile" "$repoRoot/backend"

$frontendBuildArgs = @()
if ($env:SITE_URL) { $frontendBuildArgs += @("--build-arg", "SITE_URL=$env:SITE_URL") }
if ($env:SSR_API_URL) { $frontendBuildArgs += @("--build-arg", "SSR_API_URL=$env:SSR_API_URL") }

Write-Host "Building frontend image ($registry/activswitzerland-frontend:$tag)..." -ForegroundColor Cyan
docker build @frontendBuildArgs -t "$registry/activswitzerland-frontend:$tag" -t "$registry/activswitzerland-frontend:latest" `
    --target frontend -f "$repoRoot/infra/docker/frontend/Dockerfile" "$repoRoot/frontend"

Write-Host "Building frontend-ssr image ($registry/activswitzerland-frontend-ssr:$tag)..." -ForegroundColor Cyan
docker build @frontendBuildArgs -t "$registry/activswitzerland-frontend-ssr:$tag" -t "$registry/activswitzerland-frontend-ssr:latest" `
    --target frontend-ssr -f "$repoRoot/infra/docker/frontend/Dockerfile" "$repoRoot/frontend"

Write-Host "Pushing images..." -ForegroundColor Cyan
docker push "$registry/activswitzerland-backend:$tag"
docker push "$registry/activswitzerland-backend:latest"
docker push "$registry/activswitzerland-frontend:$tag"
docker push "$registry/activswitzerland-frontend:latest"
docker push "$registry/activswitzerland-frontend-ssr:$tag"
docker push "$registry/activswitzerland-frontend-ssr:latest"

Write-Host ""
Write-Host "Done. To deploy this build on the NAS, set IMAGE_TAG=$tag in infra/.env.prod, then run infra/update.sh." -ForegroundColor Green
