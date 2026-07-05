#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# MAINTAINER-ONLY — not for operators. Re-vendors the coalition + protocol source
# from the canonical operator repo into app/, so the template ships buildable code
# for Flux/Orbit. Operators never run this; they only edit config.env + sign.
#
# In the real setup this generator lives in the moltentech repo and the template is
# its OUTPUT. It is kept here during localhost review so the vendoring is reproducible.
#
#   ./tools/vendor.sh [path-to-operator]      # default: ../moltentech/operator
# ─────────────────────────────────────────────────────────────────────────────
set -e
SRC=${1:-../moltentech/operator}
[ -d "$SRC/coalition/src" ] || { echo "error: $SRC/coalition/src not found (pass the operator repo path)"; exit 1; }

copy_pkg() {          # $1 = protocol|coalition
  name=$1
  rm -rf "app/$name"
  mkdir -p "app/$name/src"
  for meta in package.json package-lock.json tsconfig.json; do
    [ -f "$SRC/$name/$meta" ] && cp "$SRC/$name/$meta" "app/$name/"
  done
  for f in "$SRC/$name/src/"*.ts; do
    case "$f" in *.test.ts) continue ;; esac      # drop tests from the runtime image
    cp "$f" "app/$name/src/"
  done
}

copy_pkg protocol
copy_pkg coalition

# Provenance: record the exact upstream commit this was vendored from.
( cd "$SRC" && git rev-parse HEAD 2>/dev/null ) > app/VENDORED_FROM || true
echo "Vendored protocol + coalition from $SRC"
echo "  upstream commit: $(cat app/VENDORED_FROM 2>/dev/null || echo unknown)"
echo "  coalition version: $(node -e 'process.stdout.write(require("./app/coalition/package.json").version)' 2>/dev/null)"
