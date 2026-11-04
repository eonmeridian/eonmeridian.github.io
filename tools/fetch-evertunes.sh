#!/usr/bin/env bash
# Pull four Westward Ho stills from the evertunes-studio OpenSea CDN into assets/img/.
#
# These are your own works; the URLs came off your own profile page. They are fetched
# rather than committed blind so the provenance stays obvious.
#
#   bash tools/fetch-evertunes.sh && python3 tools/build.py
#
# build.py picks the stills up automatically once the files exist, and falls back to the
# generated chapter plate when they don't.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/img

C=0x495f947276749ce646f68ac8c248420045cb7b5e
fetch () {  # fetch <name> <path-under-contract>
  local out="assets/img/evertunes-$1.jpg"
  curl -fsSL "https://i2c.seadn.io/ethereum/$C/$2?w=1400" -o "$out.tmp"
  # normalize to jpeg and keep the repo small; sips is stock on macOS
  if command -v sips >/dev/null; then
    sips -s format jpeg -s formatOptions 82 "$out.tmp" --out "$out" >/dev/null
    rm -f "$out.tmp"
  else
    mv "$out.tmp" "$out"
  fi
  echo "  $out"
}

echo "fetching Westward Ho stills…"
fetch colonial-hunger ec86079e94e8204f67b28f00803c84/53ec86079e94e8204f67b28f00803c84.jpeg
fetch myth-four       c3d61d58b7b84e7c17f82c9fef210a/d7c3d61d58b7b84e7c17f82c9fef210a.png
fetch jamestown       5f9b171d1de8a4145610be6da35907/015f9b171d1de8a4145610be6da35907.png
fetch one-acre        395a6c9246b14118cf9440c6233c86/ee395a6c9246b14118cf9440c6233c86.jpeg
echo "done: now run: python3 tools/build.py"
