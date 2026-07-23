# Build and push production images to GitHub Container Registry.
# Run from the repo root after you've tested your changes locally.
#
# Usage: .\infra\build-and-push.ps1
# Requires: `docker login ghcr.io` already done once with a PAT that has write:packages.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tag = (git rev-parse --short HEAD).Trim()
$registry = "ghcr.io/cjones1975"

if ((git status --porcelain) -ne $null) {
    Write-Warning "Working tree has uncommitted changes. The pushed image won't exactly match a committed commit."
}

Write-Host "Building backend image ($registry/activswitzerland-backend:$tag)..." -ForegroundColor Cyan
docker build -t "$registry/activswitzerland-backend:$tag" -t "$registry/activswitzerland-backend:latest" `
    -f "$repoRoot/infra/docker/backend/Dockerfile" "$repoRoot/backend"

Write-Host "Building frontend image ($registry/activswitzerland-frontend:$tag)..." -ForegroundColor Cyan
docker build -t "$registry/activswitzerland-frontend:$tag" -t "$registry/activswitzerland-frontend:latest" `
    -f "$repoRoot/infra/docker/frontend/Dockerfile" "$repoRoot/frontend"

Write-Host "Pushing images..." -ForegroundColor Cyan
docker push "$registry/activswitzerland-backend:$tag"
docker push "$registry/activswitzerland-backend:latest"
docker push "$registry/activswitzerland-frontend:$tag"
docker push "$registry/activswitzerland-frontend:latest"

Write-Host ""
Write-Host "Done. To deploy this build on the NAS, set IMAGE_TAG=$tag in infra/.env.prod, then run infra/update.sh." -ForegroundColor Green
