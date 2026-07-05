'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// STUB coalition — placeholder to review the operator-facing SHAPE only.
//
// The real template will vendor operator/coalition + operator/protocol into this
// app/ directory and run `npm ci` in the Dockerfile. This stub has NO
// dependencies; it only demonstrates how the two config sources flow into the
// running app:
//   • non-secret config  → from config.env (committed, public)
//   • secrets            → from the Flux encrypted deployment env (set once)
//   • signed manifest    → from manifest.json (committed, public, re-signed on change)
// ─────────────────────────────────────────────────────────────────────────────
const http = require('node:http');
const { readFileSync } = require('node:fs');

const PORT = Number(process.env.PORT || 8088);
const MANIFEST_PATH = process.env.MANIFEST_PATH || './manifest.json';

// Non-secret config the operator edits in config.env (committed to the repo).
// TIER_PRICES_JSON is NOT edited directly — the entrypoint derives it from TIERS_JSON.
const PUBLIC_CONFIG = ['PROVIDER_SLUG', 'MT_BASE_URL', 'MT_PUBKEY', 'OWNER_ADDRESS', 'TIERS_JSON'];
// Secrets — set ONCE in the Flux encrypted deployment env, never in this repo.
const SECRETS = ['COALITION_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'AGENT_KEY', 'SESSION_SECRET'];

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

const manifest = loadManifest();
const manifestSigned = Boolean(manifest && typeof manifest.signature === 'string' && manifest.signature.length > 0);
const missingPublic = PUBLIC_CONFIG.filter((k) => !process.env[k]);
const missingSecrets = SECRETS.filter((k) => !process.env[k]);

if (missingPublic.length) console.warn(`[config]   missing non-secret config (edit config.env): ${missingPublic.join(', ')}`);
if (missingSecrets.length) console.warn(`[config]   missing secrets (set in Flux encrypted env): ${missingSecrets.join(', ')}`);
if (!manifestSigned) console.warn(`[manifest] no SIGNED manifest at ${MANIFEST_PATH} — run the sign step (tools/sign-manifest.md)`);

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      stub: true,
      provider: process.env.PROVIDER_SLUG || null,
      configComplete: missingPublic.length === 0,
      secretsPresent: missingSecrets.length === 0,
      manifestSigned,
      tierPricesDerived: process.env.TIER_PRICES_JSON ? JSON.parse(process.env.TIER_PRICES_JSON) : null,
    }, null, 2) + '\n');
    return;
  }
  // The public identity handshake MoltenTech pulls.
  if (req.url === '/.well-known/mt-provider.json') {
    if (!manifestSigned) { res.writeHead(503, { 'content-type': 'text/plain' }); res.end('manifest not configured (see tools/sign-manifest.md)\n'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('MoltenTech coalition (STUB template). Try /healthz and /.well-known/mt-provider.json\n');
});

server.listen(PORT, () => console.log(`[stub] coalition listening on :${PORT} (provider=${process.env.PROVIDER_SLUG || 'unset'})`));
