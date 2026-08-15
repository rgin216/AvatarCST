# University server deployment

The production backend runs on `sc383213l.uoa.auckland.ac.nz` under the
`rgin216` account. PM2 manages one backend worker and a Cloudflare Tunnel.
A user crontab checks GitHub `main` every minute and resurrects PM2 after a
server reboot.

## Why one backend worker

Speech-stream tokens are stored in process memory. Multiple PM2 workers could
route a token request to a different process, so the deployment stays in fork
mode with one worker. PM2 restarts it if memory exceeds 1 GiB. The shared host
has ample CPU and RAM for the current remote-API-heavy workload.

## Release flow

`deploy.sh` maintains an independent bare Git mirror and immutable releases in
`~/avatarcst-deploy`. For each new `main` commit it:

1. installs production dependencies with the pinned Node runtime;
2. requires and verifies the Rhubarb postinstall;
3. runs the backend test suite;
4. starts a candidate backend on port 5100 and health-checks it;
5. atomically switches the `current` symlink and reloads PM2;
6. rolls back the symlink if the live health check fails.

The production environment remains outside Git at
`~/avatarcst-deploy/shared/backend.env` with mode `0600`.

## Operations

```bash
# Deploy immediately
~/avatarcst-deploy/deploy.sh

# Emergency rollback/pin to a known main ancestor (still fully validated)
AVATARCST_RELEASE_SHA=<commit> ~/avatarcst-deploy/deploy.sh

# Show processes and recent logs
pm2 ls
pm2 logs avatarcst-backend --lines 100

# Print the active quick-tunnel URL
~/avatarcst-deploy/tunnel-url.sh

# Health and pipeline checks
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS http://127.0.0.1:5000/api/sessions/pipeline

# Show automatic-deploy logs
tail -n 100 ~/avatarcst-deploy/deploy.log
```

The quick-tunnel URL remains stable while the tunnel process runs but changes
if Cloudflared is recreated. For a permanent hostname, replace the tunnel PM2
entry with a named Cloudflare Tunnel token tied to a domain.
