# Signing your manifest

Your **manifest** is your signed, public self-description. MoltenTech pulls it from
your coalition at `/.well-known/mt-provider.json`. You sign it **on your own machine**
— the signing key never enters this repo, CI, or Flux.

You edit `manifest.body.json` (plain fields), then run the sign step to produce the
signed `manifest.json`. You commit **only** the signed `manifest.json`.

> The sign tool is the `mt-manifest` CLI from MoltenTech. The one-liner below uses a
> containerized version so you don't need Node installed. **(Image name is a
> placeholder — not published yet.)**

## One-time: generate your signing key

```sh
docker run --rm -it -v "$PWD:/work" -w /work moltentech/mt-manifest keygen
```

This writes `manifest-key.pem` (**KEEP SECRET — never commit; it is .gitignored**)
and prints your public key. That public key must match the `manifestPubkey`
MoltenTech pinned for you.

## Each time you change your manifest (tiers, price, coalition URL, contact…)

1. Edit `manifest.body.json`.
2. Re-sign:

   ```sh
   docker run --rm -it -v "$PWD:/work" -w /work moltentech/mt-manifest \
     sign --key manifest-key.pem --in manifest.body.json --out manifest.json
   ```

3. Commit the updated `manifest.json` and push. Flux redeploys with the new manifest.

## Notes

- **Never hand-edit `manifest.json`.** The signature covers the whole body; editing it
  by hand invalidates the signature. Always change `manifest.body.json` and re-sign.
- `coalitionUrl` in `manifest.body.json` must be your Flux app's public URL.
- Re-signing does **not** rotate your key — you keep the same `manifest-key.pem`.
