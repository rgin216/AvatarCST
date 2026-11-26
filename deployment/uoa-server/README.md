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

## Keep the Vercel frontend in sync with the Quick Tunnel

The sync job reads the latest tunnel hostname from PM2's logs. When it changes,
the job checks the new public `/api/health`, updates the production
`VITE_API_URL`, and queues a deployment. Vite embeds this value at build time,
so the old frontend may fail until the new build is live.

1. In the Vercel frontend project, make sure `VITE_API_URL` has its own entry
   scoped only to **Production**. If the existing entry covers multiple
   environments, split it and retain the existing values for the other
   environments. Use the current working tunnel URL plus `/api` as its value.
2. In Vercel **Settings → Git → Deploy Hooks**, create a hook for the project's
   production branch (usually `main`). From **Settings → General**, copy the
   project ID. Create a Vercel access token scoped to the account or team that
   owns the project. For a team project, also copy the team ID from team settings.
3. After this script is on GitHub `main` and the server has deployed that
   revision, sign into the university server as the deployment account. Create
   the private configuration file:

   ```bash
   umask 077
   touch ~/avatarcst-deploy/shared/vercel-sync.env
   chmod 600 ~/avatarcst-deploy/shared/vercel-sync.env
   nano ~/avatarcst-deploy/shared/vercel-sync.env
   ```

   Paste the following, replacing the placeholders. Omit the team ID line for
   a personal project. Keep both the token and deploy hook URL in this file.

   ```dotenv
   AVATARCST_VERCEL_TOKEN=your-token
   AVATARCST_VERCEL_PROJECT_ID=prj_your_project_id
   AVATARCST_VERCEL_TEAM_ID=team_your_team_id
   AVATARCST_VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/your-project/your-hook
   ```

4. Run the job once on the server and confirm Vercel shows a new production
   deployment. Once it is Ready, start a session from the frontend.

   ```bash
   flock -n "$HOME/avatarcst-deploy/shared/vercel-sync.lock" \
     "$HOME/.local/node-current/bin/node" \
     --env-file="$HOME/avatarcst-deploy/shared/vercel-sync.env" \
     "$HOME/avatarcst-deploy/current/deployment/uoa-server/sync-vercel-api.mjs" \
     "$HOME/avatarcst-deploy/shared"
   ```

5. Run `crontab -e` and add the line below alongside the existing deployment
   entries. It checks every minute and exits without calling Vercel when it has
   already queued a build for that URL.

   ```cron
   * * * * * flock -n "$HOME/avatarcst-deploy/shared/vercel-sync.lock" "$HOME/.local/node-current/bin/node" --env-file="$HOME/avatarcst-deploy/shared/vercel-sync.env" "$HOME/avatarcst-deploy/current/deployment/uoa-server/sync-vercel-api.mjs" "$HOME/avatarcst-deploy/shared" >> "$HOME/avatarcst-deploy/shared/vercel-sync.log" 2>&1
   ```

The next run retries health checks and Vercel requests that fail before a build
is queued. Check `~/avatarcst-deploy/shared/vercel-sync.log` for those failures.
If Vercel accepts a build and the build later fails, check the build logs in
Vercel, fix the error, and retry the deployment there.
