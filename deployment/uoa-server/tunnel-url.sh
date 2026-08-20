#!/usr/bin/env bash
set -Eeuo pipefail

log_dir="${PM2_HOME:-$HOME/.pm2}/logs"
url="$({
  grep -hEo 'https://[a-z0-9-]+\.trycloudflare\.com' \
    "$log_dir/avatarcst-tunnel-out.log" \
    "$log_dir/avatarcst-tunnel-error.log" 2>/dev/null || true
} | tail -n 1)"

if [[ -z "$url" ]]; then
  echo "No quick-tunnel URL has been recorded yet." >&2
  exit 1
fi

printf '%s\n' "$url"
