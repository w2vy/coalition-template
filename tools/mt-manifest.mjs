#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// mt-manifest (PROTOTYPE) — render a Provider Manifest from config.env and sign it.
//
// This is the localhost prototype of `sign --from-config`. It is self-contained
// (node:crypto only) and reproduces the EXACT signing scheme in
// operator/protocol/src/signing.ts (ed25519 over recursively key-sorted, minified
// JSON), so its output verifies with MoltenTech's real verifier.
//
//   node tools/mt-manifest.mjs keygen            # once: write manifest-key.pem + print pubkey
//   node tools/mt-manifest.mjs sign              # config.env + key -> signed manifest.json
//   node tools/mt-manifest.mjs verify            # re-verify manifest.json
//
// Flags (all optional): --config config.env  --key manifest-key.pem  --out manifest.json
//
// The final tool will live in operator/protocol (cli.ts) and ship as the
// moltentech/mt-manifest Docker image; this prototype proves the config.env->body
// mapping and cross-verifies before we touch the operator repo.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA_VERSION = 2;

// ── canonicalization + signing (copied verbatim from protocol/src/signing.ts) ──
function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}
const canonicalize = (value) => JSON.stringify(sortValue(value));

function ed25519PublicFromBase64(pubkeyB64) {
  const x = Buffer.from(pubkeyB64, "base64").toString("base64url");
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
}
function publicKeyBase64FromPrivate(key) {
  const jwk = createPublicKey(key).export({ format: "jwk" });
  return Buffer.from(jwk.x, "base64url").toString("base64");
}
function signManifestBody(body, privateKey) {
  return sign(null, Buffer.from(canonicalize(body), "utf8"), privateKey).toString("base64");
}
function verifyManifestObject(raw) {
  if (!raw || typeof raw !== "object") return false;
  const { signature, ...body } = raw;
  if (typeof signature !== "string" || typeof body.pubkey !== "string") return false;
  try {
    return verify(null, Buffer.from(canonicalize(body), "utf8"), ed25519PublicFromBase64(body.pubkey), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

// ── config.env → manifest body ──
function parseConfigEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 1) continue;
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return env;
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function buildBody(env) {
  const need = (k) => {
    const v = env[k];
    if (!v) die(`config.env: ${k} is required`);
    return v;
  };

  let tiersRaw;
  try {
    tiersRaw = JSON.parse(need("TIERS_JSON"));
  } catch {
    die("config.env: TIERS_JSON is not valid JSON");
  }
  if (!Array.isArray(tiersRaw) || tiersRaw.length === 0) die("config.env: TIERS_JSON must be a non-empty array");
  const tiers = tiersRaw.map((t, n) => {
    if (!t || typeof t.tier !== "string") die(`TIERS_JSON[${n}]: missing "tier"`);
    if (!Number.isInteger(t.capacity)) die(`TIERS_JSON[${n}] (${t.tier}): "capacity" must be an integer`);
    if (!t.storagePool) die(`TIERS_JSON[${n}] (${t.tier}): "storagePool" is required`);
    // priceCents is intentionally DROPPED — it feeds runtime prices, not the manifest.
    return { tier: t.tier, capacity: t.capacity, storagePool: String(t.storagePool) };
  });

  const provider = { slug: need("PROVIDER_SLUG"), name: need("PROVIDER_NAME") };
  if (env.PROVIDER_LOCATION) provider.location = env.PROVIDER_LOCATION;
  if (env.PROVIDER_DESCRIPTION) provider.description = env.PROVIDER_DESCRIPTION;
  if (env.PROVIDER_CONTACT) provider.contact = env.PROVIDER_CONTACT;

  const coalitionUrl = need("COALITION_URL");
  try {
    new URL(coalitionUrl);
  } catch {
    die("config.env: COALITION_URL must be a valid URL");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    provider,
    coalitionUrl,
    tiers,
    trialDays: Number(env.TRIAL_DAYS ?? 1),
    manualApproval: env.MANUAL_APPROVAL === "true",
    serviceFlags: { delegationAvailable: false, autoRenew: true, whiteLabel: false, languages: ["en"] },
    trustedSelfClaim: false,
  };
}

// ── flags ──
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const CONFIG = flag("--config", "config.env");
const KEY = flag("--key", "manifest-key.pem");
const OUT = flag("--out", "manifest.json");

switch (cmd) {
  case "keygen": {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(KEY, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    const jwk = publicKey.export({ format: "jwk" });
    const pub = Buffer.from(jwk.x, "base64url").toString("base64");
    console.log(`Wrote ${KEY} (KEEP SECRET — never commit; it is .gitignored).`);
    console.log(`Public key (must match your pinned manifestPubkey):\n${pub}`);
    break;
  }
  case "sign": {
    let priv;
    try {
      priv = createPrivateKey(readFileSync(KEY, "utf8"));
    } catch {
      die(`could not read ${KEY} — run 'keygen' first`);
    }
    const body = buildBody(parseConfigEnv(CONFIG));
    body.pubkey = publicKeyBase64FromPrivate(priv);
    body.publishedAt = new Date().toISOString();
    const manifest = { ...body, signature: signManifestBody(body, priv) };
    if (!verifyManifestObject(manifest)) die("self-verification failed (internal)");
    writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote signed manifest to ${OUT} (provider=${body.provider.slug}, ${body.tiers.length} tier(s)).`);
    console.log("Commit config.env + manifest.json and push.");
    break;
  }
  case "verify": {
    const ok = verifyManifestObject(JSON.parse(readFileSync(OUT, "utf8")));
    console.log(ok ? `OK — ${OUT} signature valid` : `FAILED — ${OUT} signature invalid`);
    process.exit(ok ? 0 : 1);
  }
  default:
    console.log("usage: node tools/mt-manifest.mjs <keygen|sign|verify> [--config config.env] [--key manifest-key.pem] [--out manifest.json]");
    process.exit(cmd ? 1 : 0);
}
