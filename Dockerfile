# Coalition template image — built by Flux (Orbit) directly from your repo.
# There is NO published image of this code; Orbit clones this repo and builds it
# on the node. The only thing pinned here is the public Node runtime base.
#
# DETERMINISM: pin the base by DIGEST in production so every Flux node builds a
# byte-identical image, e.g.
#   FROM node:22.11.0-bookworm-slim@sha256:<digest>
# (Pinning to an exact patch tag, as below, is the minimum; digest is stricter.)
FROM node:22.11.0-bookworm-slim

WORKDIR /app

# --- Real template (vendored coalition + protocol) will install deps here against
# --- a COMMITTED lockfile for reproducible builds:
#   COPY app/package.json app/package-lock.json ./app/
#   RUN cd app && npm ci --omit=dev
# The stub has no dependencies, so there is no install step.

COPY app/ ./app/
COPY config.env ./config.env
COPY manifest.json ./manifest.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8088
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "app/src/index.js"]
