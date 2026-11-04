#!/usr/bin/env bash
# Preview the site locally, exactly as GitHub Pages will serve it.
#
#   bash tools/serve.sh          # then open http://localhost:8000
#   bash tools/serve.sh 9001     # on a different port
#
# Ctrl-C to stop. Nothing here touches the live site: publishing is a
# separate step (git commit && git push).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8000}"

echo
echo "  Eon Meridian: local preview"
echo "  ----------------------------"
echo "  http://localhost:$PORT/                      the portfolio"
echo "  http://localhost:$PORT/projects/heddatron/   any work page"
echo "  http://localhost:$PORT/caerjar.html          the Caerjar page"
echo
echo "  A plain file:// open will NOT work: the projects/<slug>/ links"
echo "  need a server to resolve to their index.html. Use this."
echo
echo "  Edited tools/build.py? Run: python3 tools/build.py   then reload."
echo "  Ctrl-C to stop."
echo

command -v open >/dev/null && (sleep 1 && open "http://localhost:$PORT/") &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
