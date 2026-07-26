# Deployment: Synology DS723+ via Docker

**Status:** Live at `https://activswitzerland.com` (deployed 2026-07-23).

## Quick reference: shipping an update

This is the loop you'll use for every future release.

1. Test your changes locally as usual.
2. Commit them (`git commit`).
3. From the repo root, on your dev machine:
   ```powershell
   .\infra\build-and-push.ps1
   ```
   Builds both images tagged with the current git short SHA (+ `:latest`), pushes both to `ghcr.io/cjones1975`. Requires `docker login ghcr.io` to already be done (PAT with `write:packages`, done once).
4. SSH into the NAS, then:
   ```sh
   cd /volume1/docker/activswitzerland/infra
   sudo ./update.sh
   ```
   Pulls the new images and restarts the stack.
5. **Rollback**, if needed: edit `IMAGE_TAG` in `/volume1/docker/activswitzerland/infra/.env.prod` to a previous SHA (visible via `docker image ls` or your GHCR package history), rerun `sudo ./update.sh`.

No GitHub Actions/CI involved — builds happen on the dev machine so the NAS's 2-core CPU never has to compile anything.

## Architecture

```
Internet ──443/80──▶ Router (port-forward, pre-existing) ──▶ NAS
                                                                │
                                                 DSM Reverse Proxy
                                                 (activswitzerland.com + www, Let's Encrypt, auto-renew)
                                                                │
                                                                ▼
                                         frontend container (nginx, 127.0.0.1:8080 → 80)
                                         - serves Angular static build
                                         - proxies /api/* to backend:3000 over the docker network
                                                                │
                                                       docker network "app_network"
                                                                │
                                         backend container (NOT published to host)
                                             │                          │
                                         mongodb (bind-mounted data)   redis
```

Only `frontend` publishes a port, and only to `127.0.0.1` (DSM's reverse proxy runs on the same host). Backend/mongo/redis are internal-only — no direct internet exposure, no CORS friction (browser calls are same-origin through nginx).

## DNS (name.com)

Swisscom's home connection has a **dynamic public IP**, so plain A records would eventually go stale whenever it rotates. Fixed by pointing DNS at Swisscom's own DDNS hostname (from their Internet-Box DDNS feature) instead of a fixed IP:

- `activswitzerland.com` — **ANAME** record → the Swisscom DDNS hostname (name.com's workaround for "CNAME at the zone apex," which plain DNS doesn't allow).
- `www.activswitzerland.com` — **CNAME** record → the same Swisscom DDNS hostname.

This is transparent to everything else (Let's Encrypt, DSM reverse proxy, nginx) — they only care that the hostname resolves correctly at request time, not how. No cert/reverse-proxy changes needed when this was set up.

## Key files (repo)

- `infra/docker/frontend/Dockerfile` — multi-stage: builds the Angular prod bundle, serves via nginx.
- `frontend/nginx.conf` — SPA fallback + `/api/` proxy to `backend:3000`.
- `infra/docker-compose.prod.yml` — production stack. `mongo-express` is included but gated behind `--profile debug` and bound to `127.0.0.1` only — never runs by default.
- `infra/.env.prod.example` — template only; the real `.env.prod` lives solely on the NAS, never committed.
- `infra/build-and-push.ps1` / `infra/update.sh` — the two scripts in the update loop above.
- `backend/src/middleware/cors.js` — whitelist is `https://activswitzerland.com` + `https://www.activswitzerland.com`.

## NAS layout (one-time setup, already done)

- `/volume1/docker/activswitzerland/infra/` — holds `docker-compose.prod.yml`, `update.sh`, `.env.prod` (root-owned, `600` — only readable via `sudo`).
- `/volume1/docker/activswitzerland/mongodb/` — Mongo's bind-mounted data dir, so Hyper Backup/snapshots cover it.
- NAS Docker auth: `sudo docker login ghcr.io` done once with a **read-only** PAT (`read:packages`), separate from the dev machine's write-scoped one.
- DSM Control Panel → Security → Certificate: Let's Encrypt cert covering `activswitzerland.com` + `www.activswitzerland.com` (+ a legacy `api.activswitzerland.com` SAN kept from an older project, unused now).
- DSM Control Panel → Login Portal → Advanced → Reverse Proxy: `activswitzerland.com:443` and `www.activswitzerland.com:443` both → `http://127.0.0.1:8080`.

## Gotchas hit during setup (for next time)

- **scp fails with "subsystem request failed on channel 0"**: DSM's SSH service doesn't enable the SFTP subsystem by default. Either enable it (Control Panel → File Services → FTP → SFTP tab), or force old-style scp with `scp -O ...`.
- **scp "No such type or file" into `/volume1/...` even though the dir exists and is chmod 777**: Synology's ACL layer can block SFTP writes into paths outside a properly-registered Shared Folder even when Unix permission bits look permissive. Workaround: scp to `~/` (home dir always works) then `sudo mv` into place over SSH — or just use DSM File Station's own upload/Properties→Permission UI instead of scp.
- **Only `vi` available on DSM, no `nano`.** For editing `.env.prod`: `sudo vi <path>`, press `i` to insert, paste, `Esc`, then `:wq` to save.
- **`docker compose` needs `sudo` on Synology** — the docker socket is root-owned by default.
- **First-ever Mongo container start can exceed the healthcheck's `start_period`/retries** (mongo's docker-entrypoint does an init pass, shuts down, then restarts for real — WiredTiger recovery on that second start can take longer than expected on modest hardware). If `docker compose up -d` errors with `dependency failed to start: mongodb is unhealthy`, just check `docker ps` — it may have gone healthy moments later — and rerun `up -d`.
- **DSM reverse proxy: "This port is reserved for system only" on port 443`** when adding a second rule — not a real port conflict (DSM supports many hostnames sharing 443 via SNI). Almost always means the new rule's **Hostname** field was left blank/wildcard, colliding with an existing rule. Fill in the exact hostname (e.g. `www.activswitzerland.com`).
- **Certificate reassignment isn't automatic.** Adding a new Let's Encrypt cert (e.g. to add a SAN) doesn't retroactively rewire existing reverse-proxy rules — go to Control Panel → Security → Certificate → **Configure** and explicitly map each hostname:port service to the right certificate.
- **Verifying external access from inside your own home network can be misleading** — some routers don't support NAT hairpinning, so testing from home wifi isn't proof it works from the internet. Test from mobile data or another external network.

## Recurring theme: ISP/carrier/VPN content filtering, not our stack

Multiple times, "site unreachable" symptoms on specific networks turned out to be third-party security/parental-control filtering blocking a **young, unclassified domain** — not a bug in the deployment. Two confirmed instances:

- **NordVPN's "Scam and phishing protection"** (Threat Protection) on the Android app DNS-sinkholed the domain over VPN+wifi (`DNS_PROBE_FINISHED_NXDOMAIN`-style failure). Fixed by disabling that toggle in the app. The desktop NordVPN client didn't have the same issue.
- **Swisscom mobile's "Home Guard"** (their carrier-level content filter, not configurable from the customer's own account/app) silently drops the connection over cellular data — symptom varied between visits: sometimes a warning interstitial + 403 after "ignore," sometimes a raw `ERR_INVALID_HTTP_RESPONSE`/"can't provide a secure connection" with no interstitial at all.

**Why new self-hosted domains get flagged**: these filtering products rely on third-party domain/URL reputation databases. A brand-new domain has no crawl history, no search-engine presence, no established traffic pattern — most such systems default to *"unknown → treat as risky"* rather than *"unknown → allow"*, especially on child-safety-oriented products. Being hosted on a **residential IP** (a home NAS behind a consumer ISP, rather than a cloud/CDN IP) is a second, independent factor that nudges heuristics toward "suspicious," since that hosting pattern is also common for phishing/malware infrastructure. Expect this to fade over weeks as the domain accrues reputation; there's no fix on our end beyond contacting the filter operator to request reclassification/allowlisting.

**Diagnostic playbook if this happens again** (proves definitively whether the problem is upstream of the NAS or actually in our stack):
1. `sudo docker logs -f activswitzerland_frontend` and `sudo docker logs -f activswitzerland_backend` while reproducing — if nothing appears, the request never reached the containers.
2. `sudo tail -f /var/log/nginx/error.log` (DSM's own reverse-proxy layer, one level upstream of Docker) while reproducing — again, silence doesn't *prove* nothing arrived (it only logs errors, not successes), but errors here would show DSM-level TLS/proxy problems.
3. The conclusive test: capture packets at the NAS's network interface itself, filtered to the specific client's current public IP:
   ```sh
   sudo timeout 30 tcpdump -i eth0 host <client-public-ip> and \(port 443 or port 80\) -n -v
   ```
   (get the client's current public IP from `test-ipv6.com`/`whatismyipaddress.com` right before running this — CGNAT IPs on mobile carriers rotate). Reproduce the failure within the 30s window. **Zero packets captured = the connection never reached the NAS at all** — conclusive proof it's a network/filtering issue upstream (ISP, carrier, VPN), not the Docker/DSM stack. Also worth checking Control Panel → Security → Protection (Auto Block) for the client's IP, though in our case it wasn't the cause (only an unrelated, pre-existing block on the home router's own IP from background internet bot noise was found there).
4. Also useful, independent of the above: `sslshopper.com/ssl-checker.html` and `canyouseeme.org` confirm what's actually being served externally and whether ports are reachable *in general* — useful for ruling out an actual server-side cert/config problem before assuming it's ISP-side.

## Known optional cleanup (not urgent)

- Old reverse-proxy rule `api.activswitzerland.com → 127.0.0.1:3100` is dead (nothing listens on 3100 in the new architecture) — safe to delete whenever.
- The original certificate (covering `activswitzerland.com` + `api.activswitzerland.com`, no `www`) is likely superseded by the new one — confirm via the Configure screen that nothing still references it, then delete.
