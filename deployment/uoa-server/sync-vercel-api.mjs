import { execFileSync } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { AVATARCST_VERCEL_TOKEN, AVATARCST_VERCEL_PROJECT_ID,
  AVATARCST_VERCEL_TEAM_ID, AVATARCST_VERCEL_DEPLOY_HOOK } = process.env;

async function request(url, options, label) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`${label} failed to connect or timed out`);
  }

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
  return response;
}

async function sync() {
  const sharedDir = process.argv[2];
  if (!sharedDir || !AVATARCST_VERCEL_TOKEN ||
      !/^prj_[\w-]+$/.test(AVATARCST_VERCEL_PROJECT_ID ?? '') ||
      !/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[\w-]+\/[\w-]+$/.test(AVATARCST_VERCEL_DEPLOY_HOOK ?? '')) {
    throw new Error('Set the shared directory, Vercel token, project ID and deploy hook');
  }

  const tunnelUrl = execFileSync('bash', [
    fileURLToPath(new URL('./tunnel-url.sh', import.meta.url)),
  ], { encoding: 'utf8', timeout: 5000 }).trim();
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(tunnelUrl)) {
    throw new Error('Expected an HTTPS Cloudflare Quick Tunnel URL');
  }
  const apiUrl = `${tunnelUrl}/api`;
  const statePath = join(sharedDir, `vercel-api-${AVATARCST_VERCEL_PROJECT_ID}.url`);
  const lastQueuedUrl = await readFile(statePath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (lastQueuedUrl.trim() === apiUrl) return;

  const health = await request(`${apiUrl}/health`, {}, 'Tunnel health check');
  if ((await health.json()).status !== 'ok') {
    throw new Error('Tunnel health check did not report status ok');
  }

  const envUrl = new URL(`https://api.vercel.com/v9/projects/${AVATARCST_VERCEL_PROJECT_ID}/env`);
  if (AVATARCST_VERCEL_TEAM_ID) envUrl.searchParams.set('teamId', AVATARCST_VERCEL_TEAM_ID);
  const headers = {
    Authorization: `Bearer ${AVATARCST_VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const listing = await request(envUrl, { headers }, 'Vercel environment lookup');
  const { envs } = await listing.json();
  const production = envs.filter(({ key, target }) =>
    key === 'VITE_API_URL' && target?.includes('production'));
  if (production.length !== 1 || production[0].target.length !== 1) {
    throw new Error('Create exactly one VITE_API_URL entry scoped only to Production in Vercel');
  }

  envUrl.pathname += `/${encodeURIComponent(production[0].id)}`;
  await request(envUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ value: apiUrl }),
  }, 'Vercel environment update');
  const deployment = await request(
    AVATARCST_VERCEL_DEPLOY_HOOK, { method: 'POST' }, 'Vercel deploy hook',
  );
  if (!(await deployment.json()).job?.id) {
    throw new Error('Vercel deploy hook did not return a job ID');
  }

  await writeFile(`${statePath}.tmp`, `${apiUrl}\n`);
  await rename(`${statePath}.tmp`, statePath);
  console.log(`Queued production deployment for ${apiUrl}`);
}

sync().catch((error) => {
  console.error(`Vercel API sync failed: ${error.message}`);
  process.exitCode = 1;
});
