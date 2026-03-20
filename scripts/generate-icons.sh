#!/usr/bin/env bash
#
# Generate PWA PNG icons from icon.svg
#
# Prerequisites (pick one):
#   brew install librsvg    # provides rsvg-convert (recommended)
#   brew install imagemagick # provides magick/convert
#
# Usage:
#   chmod +x scripts/generate-icons.sh
#   ./scripts/generate-icons.sh

set -euo pipefail
cd "$(dirname "$0")/.."

SVG="public/icon.svg"
OUT="public"

if ! [ -f "$SVG" ]; then
  echo "Error: $SVG not found"
  exit 1
fi

# Generate standard icons
generate_with_rsvg() {
  echo "Using rsvg-convert..."
  for size in 192 512; do
    rsvg-convert -w "$size" -h "$size" "$SVG" > "$OUT/icon-${size}.png"
    echo "  Created icon-${size}.png"
  done
}

generate_with_magick() {
  echo "Using ImageMagick..."
  for size in 192 512; do
    magick -background none -density 300 "$SVG" -resize "${size}x${size}" "$OUT/icon-${size}.png"
    echo "  Created icon-${size}.png"
  done
}

# Generate maskable icons (add 10% padding on each side for safe zone)
generate_maskable_with_rsvg() {
  echo "Generating maskable icons with rsvg-convert..."
  for size in 192 512; do
    # Inner content is 80% of final size, centered on background
    inner=$(( size * 80 / 100 ))
    pad=$(( (size - inner) / 2 ))
    # Render at inner size, then composite onto a solid background
    rsvg-convert -w "$inner" -h "$inner" "$SVG" > "/tmp/pwa-inner-${size}.png"
    magick -size "${size}x${size}" "xc:#1a1a2e" "/tmp/pwa-inner-${size}.png" \
      -geometry "+${pad}+${pad}" -composite "$OUT/icon-maskable-${size}.png"
    rm "/tmp/pwa-inner-${size}.png"
    echo "  Created icon-maskable-${size}.png"
  done
}

generate_maskable_with_magick() {
  echo "Generating maskable icons with ImageMagick..."
  for size in 192 512; do
    inner=$(( size * 80 / 100 ))
    magick -background "#1a1a2e" -density 300 "$SVG" \
      -resize "${inner}x${inner}" \
      -gravity center -extent "${size}x${size}" \
      "$OUT/icon-maskable-${size}.png"
    echo "  Created icon-maskable-${size}.png"
  done
}

# Pick available tool
if command -v rsvg-convert &>/dev/null; then
  generate_with_rsvg
  if command -v magick &>/dev/null; then
    generate_maskable_with_rsvg
  else
    echo "  (Skipping maskable icons -- install ImageMagick for compositing)"
    echo "  You can copy icon-192.png -> icon-maskable-192.png as a fallback"
  fi
elif command -v magick &>/dev/null; then
  generate_with_magick
  generate_maskable_with_magick
else
  echo "Error: Neither rsvg-convert nor ImageMagick found."
  echo "Install one of:"
  echo "  brew install librsvg"
  echo "  brew install imagemagick"
  exit 1
fi

echo ""
echo "Done! Icons generated in $OUT/"
echo "Files:"
ls -lh "$OUT"/icon*.png 2>/dev/null || echo "  (no PNG files found -- check for errors above)"
