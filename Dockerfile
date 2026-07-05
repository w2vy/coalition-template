# Coalition template image — built by Flux (Orbit) directly from your repo. There is
# NO published image of this code; Orbit clones this repo and builds it on the node.
# The vendored coalition + protocol source lives in app/ (maintained upstream; not
# something operators edit).
#
# DETERMINISM: pin the base by DIGEST in production so every Flux node builds a
# byte-identical image, e.g. FROM node:22.11.0-bookworm-slim@sha256:<digest>.
# npm ci against the committed lockfiles keeps dependencies reproducible.
FROM node:22.11.0-bookworm-slim

WORKDIR /app

# Install both package roots so the `file:../protocol` dep resolves and each
# package's own deps are present. Lockfiles are committed → npm ci (reproducible);
# fall back to npm install if a lockfile is missing.
COPY app/protocol/package.json app/protocol/package-lock.json* ./protocol/
RUN cd protocol && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund)
COPY app/coalition/package.json app/coalition/package-lock.json* ./coalition/
RUN cd coalition && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund)

COPY app/protocol/ ./protocol/
COPY app/coalition/ ./coalition/

# Provider payload (all public): non-secret config + signed manifest + entrypoint.
COPY config.env ./config.env
COPY manifest.json ./manifest.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /app/coalition
# The signed manifest sits at the repo root inside the image; point the coalition at it.
ENV MANIFEST_PATH=/app/manifest.json
EXPOSE 8088
# The entrypoint merges config.env + Flux secret env (+ derives TIER_PRICES_JSON),
# then hands off to the coalition (npm start = tsx src/index.ts).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
