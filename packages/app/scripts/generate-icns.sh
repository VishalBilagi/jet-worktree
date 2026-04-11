#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_PNG="$ROOT_DIR/resources/AppIcon.icon/Assets/jt-2.png"
BUILD_DIR="$ROOT_DIR/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
OUTPUT_ICNS="$BUILD_DIR/icon.icns"

if [ ! -f "$SOURCE_PNG" ]; then
  echo "Missing source icon: $SOURCE_PNG" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"
TMP_DIR="$(mktemp -d "$BUILD_DIR/icon-tmp.XXXXXX")"

cleanup() {
  rm -rf "$ICONSET_DIR" "$TMP_DIR"
}

trap cleanup EXIT

# electron-builder still expects a traditional .icns, even though Tahoe uses
# the bundled .icon asset named by CFBundleIconName for liquid glass rendering.
for size in 16 32 128 256 512; do
  resized="$TMP_DIR/${size}.png"
  resized_2x="$TMP_DIR/${size}@2x.png"

  sips -Z "$size" "$SOURCE_PNG" --out "$resized" >/dev/null
  sips -p "$size" "$size" "$resized" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null

  size_2x="$((size * 2))"
  sips -Z "$size_2x" "$SOURCE_PNG" --out "$resized_2x" >/dev/null
  sips -p "$size_2x" "$size_2x" "$resized_2x" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"
