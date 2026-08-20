#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_NAME="avatarcst-backend"
readonly BASE_DIR="${AVATARCST_DEPLOY_DIR:-$HOME/avatarcst-deploy}"
readonly MIRROR_DIR="$BASE_DIR/repository.git"
readonly RELEASES_DIR="$BASE_DIR/releases"
readonly SHARED_DIR="$BASE_DIR/shared"
readonly CURRENT_LINK="$BASE_DIR/current"
readonly ECOSYSTEM_FILE="$BASE_DIR/ecosystem.config.cjs"
readonly DEPLOYED_SHA_FILE="$BASE_DIR/deployed-sha"
readonly FAILED_SHA_FILE="$BASE_DIR/failed-sha"
readonly LOCK_FILE="$BASE_DIR/deploy.lock"
readonly REPOSITORY_URL="${AVATARCST_REPOSITORY_URL:-https://github.com/rgin216/AvatarCST.git}"
readonly NODE_HOME="${AVATARCST_NODE_HOME:-$HOME/.local/node-current}"
readonly NODE_BIN="$NODE_HOME/bin/node"
readonly NPM_BIN="$NODE_HOME/bin/npm"
readonly PM2_BIN="${AVATARCST_PM2_BIN:-/usr/bin/pm2}"
readonly CANDIDATE_PORT="${AVATARCST_CANDIDATE_PORT:-5100}"
readonly LIVE_URL="http://127.0.0.1:5000/api/health"
readonly CANDIDATE_URL="http://127.0.0.1:${CANDIDATE_PORT}/api/health"

mkdir -p "$BASE_DIR" "$RELEASES_DIR" "$SHARED_DIR/generated-audio" "$SHARED_DIR/temp"
chmod 700 "$BASE_DIR" "$SHARED_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment is already running; exiting."
  exit 0
fi

timestamp() {
  date --iso-8601=seconds
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

wait_for_health() {
  local url="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"
  local i

  for ((i = 1; i <= attempts; i += 1)); do
    if curl --fail --silent --show-error --max-time 3 "$url" >/dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

if [[ ! -x "$NODE_BIN" || ! -x "$NPM_BIN" ]]; then
  echo "Node runtime is missing at $NODE_HOME" >&2
  exit 1
fi

if [[ ! -f "$SHARED_DIR/backend.env" ]]; then
  echo "Missing production environment file: $SHARED_DIR/backend.env" >&2
  exit 1
fi
chmod 600 "$SHARED_DIR/backend.env"

if [[ ! -d "$MIRROR_DIR" ]]; then
  log "Creating deployment mirror"
  git clone --bare "$REPOSITORY_URL" "$MIRROR_DIR"
fi

log "Fetching origin/main"
git --git-dir="$MIRROR_DIR" fetch --quiet --prune origin \
  '+refs/heads/main:refs/heads/main'
main_sha="$(git --git-dir="$MIRROR_DIR" rev-parse refs/heads/main)"
release_sha="${AVATARCST_RELEASE_SHA:-$main_sha}"
if ! git --git-dir="$MIRROR_DIR" cat-file -e "${release_sha}^{commit}" 2>/dev/null; then
  echo "Unknown release revision: $release_sha" >&2
  exit 1
fi
if ! git --git-dir="$MIRROR_DIR" merge-base --is-ancestor "$release_sha" "$main_sha"; then
  echo "Refusing to deploy a revision that is not an ancestor of origin/main: $release_sha" >&2
  exit 1
fi

if [[ -f "$DEPLOYED_SHA_FILE" ]] \
  && [[ "$(<"$DEPLOYED_SHA_FILE")" == "$release_sha" ]] \
  && [[ -L "$CURRENT_LINK" ]]; then
  exit 0
fi

# A broken main revision is retried after an hour, not every minute.
if [[ -f "$FAILED_SHA_FILE" ]] && [[ "$(cut -d' ' -f1 "$FAILED_SHA_FILE")" == "$release_sha" ]]; then
  failed_at="$(cut -d' ' -f2 "$FAILED_SHA_FILE")"
  now="$(date +%s)"
  if [[ "$failed_at" =~ ^[0-9]+$ ]] && ((now - failed_at < 3600)); then
    log "Skipping recently failed revision $release_sha"
    exit 0
  fi
fi

release_dir="$RELEASES_DIR/$release_sha"
staging_dir=""
candidate_pid=""

cleanup() {
  if [[ -n "$candidate_pid" ]]; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
  fi

  if [[ -n "$staging_dir" && -d "$staging_dir" ]]; then
    case "$staging_dir" in
      "$RELEASES_DIR"/.staging-*) rm -rf -- "$staging_dir" ;;
      *) log "Refusing to remove unexpected staging path: $staging_dir" ;;
    esac
  fi
}
trap cleanup EXIT

mark_failed() {
  printf '%s %s\n' "$release_sha" "$(date +%s)" >"$FAILED_SHA_FILE"
}

if [[ ! -d "$release_dir" ]]; then
  staging_dir="$RELEASES_DIR/.staging-${release_sha}-$$"
  mkdir -m 700 "$staging_dir"
  log "Extracting revision $release_sha"
  git --git-dir="$MIRROR_DIR" archive "$release_sha" | tar -x -C "$staging_dir"

  ln -s ../../../shared/backend.env "$staging_dir/backend/.env"
  ln -s ../../../shared/generated-audio "$staging_dir/backend/generated-audio"
  ln -s ../../../shared/temp "$staging_dir/backend/temp"

  # npm 11 requires dependency lifecycle scripts to be reviewed. ffmpeg-static
  # needs its installer; msedge-tts only uses preinstall to reject npm users.
  "$NODE_BIN" --input-type=module - "$staging_dir/backend/package.json" <<'NODE'
import fs from 'node:fs';

const packagePath = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.allowScripts = {
  ...(packageJson.allowScripts || {}),
  'ffmpeg-static': true,
  'fsevents': false,
  'msedge-tts': false,
};
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

  log "Installing production dependencies with Node $($NODE_BIN --version)"
  if ! (
    cd "$staging_dir/backend"
    PATH="$NODE_HOME/bin:$PATH" REQUIRE_RHUBARB=1 \
      "$NPM_BIN" ci --omit=dev --strict-allow-scripts=true
  ); then
    mark_failed
    exit 1
  fi

  log "Verifying ffmpeg and speech dependencies"
  if ! (
    cd "$staging_dir/backend"
    PATH="$NODE_HOME/bin:$PATH" "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  throw new Error(`ffmpeg-static binary is missing: ${ffmpegPath}`);
}
const result = spawnSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
if (result.status !== 0) {
  throw new Error(`ffmpeg-static failed with exit code ${result.status}`);
}
await import('msedge-tts');
NODE
  ); then
    mark_failed
    exit 1
  fi

  log "Running backend tests"
  if ! (
    cd "$staging_dir/backend"
    mapfile -d '' test_files < <(find src -type f -name '*.test.js' -print0 | sort -z)
    if ((${#test_files[@]} == 0)); then
      echo "No backend test files were found." >&2
      exit 1
    fi
    PATH="$NODE_HOME/bin:$PATH" "$NODE_BIN" --test "${test_files[@]}"
  ); then
    mark_failed
    exit 1
  fi

  mv "$staging_dir" "$release_dir"
  staging_dir=""
fi

log "Starting candidate instance on port $CANDIDATE_PORT"
(
  cd "$release_dir/backend"
  exec env NODE_ENV=production PORT="$CANDIDATE_PORT" PATH="$NODE_HOME/bin:$PATH" \
    "$NODE_BIN" src/server.js
) >"$BASE_DIR/candidate.log" 2>&1 &
candidate_pid="$!"

if ! wait_for_health "$CANDIDATE_URL" 45 1; then
  log "Candidate health check failed"
  mark_failed
  tail -n 80 "$BASE_DIR/candidate.log" >&2 || true
  exit 1
fi

kill "$candidate_pid" 2>/dev/null || true
wait "$candidate_pid" 2>/dev/null || true
candidate_pid=""

previous_release=""
if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
fi

ln -sfn "$release_dir" "$BASE_DIR/current.next"
mv -Tf "$BASE_DIR/current.next" "$CURRENT_LINK"

log "Activating revision $release_sha"
"$PM2_BIN" delete "$APP_NAME" >/dev/null 2>&1 || true
if ! "$PM2_BIN" start "$ECOSYSTEM_FILE" --only "$APP_NAME" --update-env; then
  mark_failed
  exit 1
fi

if ! wait_for_health "$LIVE_URL" 45 1; then
  log "Live health check failed; rolling back"
  mark_failed
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$BASE_DIR/current.next"
    mv -Tf "$BASE_DIR/current.next" "$CURRENT_LINK"
    "$PM2_BIN" delete "$APP_NAME" >/dev/null 2>&1 || true
    "$PM2_BIN" start "$ECOSYSTEM_FILE" --only "$APP_NAME" --update-env || true
  fi
  exit 1
fi

printf '%s\n' "$release_sha" >"$DEPLOYED_SHA_FILE"
rm -f "$FAILED_SHA_FILE"
"$PM2_BIN" save --force >/dev/null
log "Deployment succeeded: $release_sha"
