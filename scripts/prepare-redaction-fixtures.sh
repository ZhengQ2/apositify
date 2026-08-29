#!/usr/bin/env bash
# Writes known values into specimens whose real reference is redacted.
#
# Several specimens have item 8 blacked out or replaced with placeholder Xs, so
# there is no ground truth to assert against and no way to tell a parser bug
# from a document that simply does not carry the value. This renders a known
# value onto the item's own row, using the OCR geometry of its numbered label,
# and the tests then assert that exact value comes back.
set -euo pipefail

tool="${TMPDIR:-/tmp}/apositify-fill-redacted-specimen"
destination="specimens/redaction-filled"

swiftc -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
  -framework AppKit -framework Vision -framework ImageIO \
  scripts/fill-redacted-specimen.swift -o "$tool"

mkdir -p "$destination"

fill() {
  local source="$1" name="$2" item="$3" value="$4"
  if [ ! -f "$source" ]; then
    echo "SKIP $name: $source is not present"
    return 0
  fi
  "$tool" "$source" "$destination/$name" "$item" "$value" || echo "SKIP $name: no item $item anchor was found"
}

fill specimens/bahrain.png bahrain-filled.png 8 "APO-2209051234"
fill specimens/hong-kong.JPG hong-kong-filled.png 8 "2781234"
