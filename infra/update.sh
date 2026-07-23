#!/bin/sh
# Run on the NAS (via SSH or DSM Task Scheduler) to deploy whatever IMAGE_TAG
# is set to in .env.prod. Rollback = edit IMAGE_TAG to a previous tag, rerun.
set -eu

cd "$(dirname "$0")"

docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
docker image prune -f
