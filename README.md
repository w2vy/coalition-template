# MoltenTech Coalition — provider template

This is your **coalition** — the small public web service that fronts your MoltenTech
marketplace listing (serves your signed manifest + stats, handles checkout/manage,
and hosts your operator console). You run it as a **Flux app built straight from this
repo** — there is no image to build or push. Flux clones this repo and builds it for you.

> **You need:** a GitHub account, a Flux/ZelID wallet (you already have one as a node
> operator), Docker (you already have it for the agent), and about 15 minutes. You do
> **not** need to be a git expert — most steps are clicks in the GitHub website.

---

## The 5 steps

### 1. Fork this repo
Click **Fork** (top-right on GitHub). You now have your own copy.

### 2. Fill in the one config file
Edit **`config.env`** (click it → pencil icon → edit in the browser). Fill in the
labeled lines — identity, `OWNER_ADDRESS`, `MT_PUBKEY`, your `COALITION_URL`, and your
`TIERS_JSON` (tiers + prices, all in one place). Commit.

### 3. Sign your manifest
On your own machine, run the one signing command (see **`tools/sign-manifest.md`**). It
reads `config.env`, generates your key (which **stays on your machine**), and writes a
signed `manifest.json`.

### 4. Publish the signed manifest
Commit the generated `manifest.json` to your fork (paste it in via the pencil icon, or
`git add manifest.json && git commit && git push`).

### 5. Deploy on Flux
Register a Flux app pointing at your fork (Flux Git deployment). During that one-time
setup, put your **secrets** in the Flux **encrypted** environment (next section).

Done. To change anything later (prices, tiers, description), edit **`config.env`**,
re-sign, commit — Flux redeploys. **You never touch the Flux environment again unless
you rotate a key.**

---

## Where things live (and why)

| Thing | Lives in | Changes? |
|-------|----------|----------|
| All non-secret config (`config.env`) | **this repo** (public) | edit + commit |
| Signed `manifest.json` (generated from `config.env`) | **this repo** (public) | re-sign + commit |
| Your manifest signing key (`manifest-key.pem`) | **your machine only** | never leaves; `.gitignore`d |
| Secrets (below) | **Flux encrypted env** | set **once**; only on key rotation |

### Where secrets live
Set these **once** in the Flux **encrypted** deployment environment at step 5 —
**never** in this repo:

- `COALITION_KEY` — MoltenTech → you (issued in the MoltenTech admin)
- `STRIPE_SECRET_KEY` — your restricted Stripe key
- `STRIPE_WEBHOOK_SECRET` — your Stripe webhook signing secret
- `AGENT_KEY` — you → MoltenTech relay key
- `SESSION_SECRET` — any long random string (`openssl rand -hex 32`); signs your
  console login cookie

They rarely change, so you set them once and forget them. Rotating one is the only time
you edit the Flux environment again.

---

## One source of truth for tiers + prices

You define your tiers **once**, in `config.env`:

```
TIERS_JSON=[{"tier":"nimbus","capacity":8,"storagePool":"local-lvm","priceCents":2200}]
```

- The **manifest** takes `tier` + `capacity` + `storagePool` (signed).
- Your **runtime prices** (`TIER_PRICES_JSON`) are derived from `priceCents` automatically.

So a price change is one edit in one place — no chance of the manifest and your prices
drifting apart.

---

## Test it locally first (optional)

```sh
docker build -t coalition-local .
docker run --rm -p 8088:8088 \
  -e COALITION_KEY=test -e STRIPE_SECRET_KEY=test -e STRIPE_WEBHOOK_SECRET=test \
  -e AGENT_KEY=test -e SESSION_SECRET=test \
  coalition-local

curl -s localhost:8088/healthz            # -> config/secret/manifest readiness + derived prices
curl -s localhost:8088/.well-known/mt-provider.json
```

> **Note:** this repo currently ships a **stub** app so you can review the shape and
> flow. The real coalition code drops into `app/` unchanged; nothing about the steps
> above changes.
