# Signing your manifest

Your **manifest** is your signed, public self-description. MoltenTech pulls it from
your coalition at `/.well-known/mt-provider.json`. You sign it **on your own machine**
— the signing key never enters this repo, CI, or Flux.

You do **not** edit the manifest directly. The sign step reads your **`config.env`**,
builds the manifest body from it, signs it, and writes `manifest.json`. You commit
only the signed `manifest.json`.

> The sign tool is the `mt-manifest` CLI from MoltenTech. The final form ships as a
> small Docker image (`moltentech/mt-manifest`, **not published yet**) so you don't
> need Node installed. **Until then, a working prototype lives in this repo** —
> `tools/mt-manifest.mjs` — usable with any Node 20+:
>
> ```sh
> node tools/mt-manifest.mjs keygen    # once
> node tools/mt-manifest.mjs sign      # config.env -> manifest.json
> node tools/mt-manifest.mjs verify    # re-check
> ```
>
> Its output is byte-compatible with MoltenTech's real verifier. The `docker run`
> commands below are the future form — same subcommands, no Node needed.

## One-time: generate your signing key

```sh
docker run --rm -it -v "$PWD:/work" -w /work moltentech/mt-manifest keygen
```

Writes `manifest-key.pem` (**KEEP SECRET — never commit; it is `.gitignore`d**) and
prints your public key. That public key must match the `manifestPubkey` MoltenTech
pinned for you.

## Each time you change your offering (tiers, price, coalition URL, contact…)

1. Edit **`config.env`** (the one file).
2. Render + sign from it:

   ```sh
   docker run --rm -it -v "$PWD:/work" -w /work moltentech/mt-manifest sign
   ```

   This reads `config.env` + `manifest-key.pem`, and writes a fresh signed
   `manifest.json`.
3. Commit `config.env` + `manifest.json` and push. Flux redeploys with the new manifest.

## How config.env maps into the manifest

| config.env | manifest field |
|------------|----------------|
| `PROVIDER_SLUG` / `PROVIDER_NAME` / `PROVIDER_LOCATION` / `PROVIDER_DESCRIPTION` / `PROVIDER_CONTACT` | `provider.*` |
| `COALITION_URL` | `coalitionUrl` |
| `TIERS_JSON` → each `{tier, capacity, storagePool}` (price dropped) | `tiers[]` |
| `TRIAL_DAYS` | `trialDays` |
| `MANUAL_APPROVAL` | `manualApproval` |
| *(tool defaults)* | `serviceFlags`, `schemaVersion`, `trustedSelfClaim:false` |

`priceCents` from `TIERS_JSON` is **not** put in the manifest — it feeds your runtime
prices only. This is why tiers are defined once and never drift.

## Notes

- **Never hand-edit `manifest.json`.** The signature covers the whole body; editing it
  by hand invalidates the signature. Change `config.env` and re-sign.
- Re-signing does **not** rotate your key — you keep the same `manifest-key.pem`.
