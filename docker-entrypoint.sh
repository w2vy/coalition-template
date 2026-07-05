#!/bin/sh
# Merge the two config sources into the process environment, then start the app.
#
#   1. config.env      — non-secret provider config, committed to this repo (public)
#   2. Flux encrypted  — secrets, injected by Flux as real env vars at runtime
#      deployment env     (COALITION_KEY, STRIPE_*, AGENT_KEY, SESSION_SECRET)
#
# Flux-injected env is already present; we only need to layer config.env on top of
# it. We do NOT overwrite anything Flux set (secrets win), so the two never collide.
set -e

if [ -f /app/config.env ]; then
  # Export every assignment in config.env that is not already set in the environment.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;                    # skip blanks + comments
    esac
    key=${line%%=*}
    if [ -z "$(printenv "$key" 2>/dev/null)" ]; then
      export "$line"
    fi
  done < /app/config.env
fi

# Optional: allow the signed manifest to arrive via env (image-based deploys) when
# it is not committed as a file. In the git-deploy template it IS committed, so this
# is a no-op unless MANIFEST_JSON is set and no file exists.
if [ -n "${MANIFEST_JSON:-}" ] && [ ! -s /app/manifest.json ]; then
  printf '%s' "$MANIFEST_JSON" > /app/manifest.json
fi

exec "$@"
