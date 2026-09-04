#!/usr/bin/env sh
# Regenerates public/og.png from scripts/og/og.template.html using headless Chrome.
# Inter woff2 files come from Astro's font cache, so run `npm run build` (or dev) once first.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/scripts/og"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
font() { ls "$ROOT"/.astro/fonts/font-inter-"$1"-normal-latin-*.woff2 | head -1; }
sed -e "s#__F400__#file://$(font 400)#" -e "s#__F500__#file://$(font 500)#" \
    -e "s#__F600__#file://$(font 600)#" -e "s#__F700__#file://$(font 700)#" \
    "$DIR/og.template.html" > "$DIR/.og.render.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$ROOT/public/og.png" "file://$DIR/.og.render.html" 2>/dev/null
rm -f "$DIR/.og.render.html"
echo "wrote public/og.png"
