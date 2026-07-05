# Deploy your coalition on Flux

Your coalition runs as a **Flux Git deployment** (Orbit): Flux clones this repo and
builds it on the node — there is no image to publish. You register the app once, and
Flux serves it over HTTPS on a public domain.

> **Prereqs:** a Flux/ZelID wallet with some FLUX (app registration is a small paid,
> signed transaction), and this repo **already configured** — `config.env` filled in
> and a **signed `manifest.json` committed** (see `tools/sign-manifest.md`).

---

## 1. Register the app (Orbit git deployment)

Create a Flux app pointing at your fork. The important parameters:

| Parameter | Value | Why |
|-----------|-------|-----|
| Runner image (`repotag`) | `runonflux/orbit:latest` | the Orbit git-deploy runner (builds your repo) |
| `GIT_REPO_URL` | your fork's HTTPS URL | the repo Orbit clones |
| `GIT_BRANCH` | `master` | this template's default branch |
| `PROJECT_PATH` | `/` | the `Dockerfile` is at the repo root |
| `APP_PORT` | `8088` | the port the coalition listens on (matches `config.env` `PORT`) |
| Exposed (public) port | any allowed port | Flux maps it → `APP_PORT` inside |
| Instances | `1` for a first test (`3` typical) | |
| CPU / RAM / HDD | `1` / `2000` MB / `10` GB | comfortable for the Node coalition |

If you use the fluxtools MCP, `flux_git_deploy_generate_spec_v8` produces this spec —
pass `name`, `owner`, `repoUrl`, `branch=master`, `appPort=8088`, and the secret env
below; it defaults `repotag` to Orbit and picks safe ports.

---

## 2. Set your secrets in the Flux environment

`config.env` (non-secret, in the repo) is baked in and merged at startup. The **5
secrets** are NOT in the repo — set them as **additional app environment entries**
(use Flux's **encrypted** env for these):

```
COALITION_KEY=…            # MT admin → Issue keys
STRIPE_SECRET_KEY=…        # your restricted Stripe key
STRIPE_WEBHOOK_SECRET=…    # your Stripe webhook signing secret
AGENT_KEY=…                # MT admin → Issue keys
SESSION_SECRET=…           # openssl rand -hex 32
```

They rarely change, so you set them once. `MT_PUBKEY` and `OWNER_ADDRESS` are
non-secret and already live in `config.env`.

---

## 3. Verify (once it's running)

Flux gives the app a public HTTPS URL. Check:

```sh
curl -s https://<your-app-domain>/health
# -> {"ok":true,"provider":"<your-slug>","coalitionVersion":"0.1.0"}

curl -si https://<your-app-domain>/health | grep -i x-coalition-version
# -> X-Coalition-Version: 0.1.0

curl -s https://<your-app-domain>/.well-known/mt-provider.json | head
# -> your SIGNED manifest (has a "signature" field)
```

Then point your manifest's `coalitionUrl` at this domain (re-sign + commit if it
changed), and add the coalition URL in the MoltenTech admin so MT pulls your stats.

---

## 4. Updating later

Edit `config.env` / re-sign `manifest.json` → commit → push. Redeploy the app so
Orbit re-pulls. **You don't touch the Flux environment again unless you rotate a key.**

---

## Troubleshooting / things to confirm on the first deploy

- **Does Orbit honor this repo's `Dockerfile` + `ENTRYPOINT`?** The coalition relies on
  `docker-entrypoint.sh` to merge `config.env` with the Flux secret env and derive
  `TIER_PRICES_JSON`. If the app boots and `/health` shows your slug + version, that
  path ran. If it crashes on missing config (e.g. `TIER_PRICES_JSON`), Orbit isn't
  running our entrypoint — tell the maintainers (the merge would need to move into the
  app's start script).
- **Port mismatch** — the coalition listens on `8088`; `APP_PORT` must be `8088` so Orbit
  maps the public port to it. `/health` timing out usually means a port mismatch.
- **`/.well-known` returns a placeholder** — you deployed before signing; run the sign
  step, commit `manifest.json`, redeploy.
- **Redeploy trigger** — note whether a `git push` alone redeploys, or you must trigger
  Orbit (via its management port / the Flux UI). This determines how hands-off updates are.
