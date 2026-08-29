#!/usr/bin/env bash
# Copies the local specimen corpus into the iOS device test target.
#
# Specimen photographs are private and stay in the gitignored specimens/
# directory. A checkout without them still builds; the device tests skip.
set -euo pipefail

destination="ios/ApositifyDeviceTests/Specimens"
mkdir -p "$destination"
find "$destination" -type f ! -name '.gitkeep' -delete

copied=0
for source in specimens/*.png specimens/*.jpg specimens/*.jpeg specimens/*.JPG \
              specimens/*.heic specimens/*.webp specimens/device-test-local/* \
              specimens/redaction-filled/*; do
  [ -f "$source" ] || continue
  cp "$source" "$destination/"
  copied=$((copied + 1))
done

echo "Staged $copied specimens in $destination"
