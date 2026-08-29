#!/usr/bin/env bash
# Runs the specimen corpus through the app on a physically attached iPhone.
#
# Apple Vision on the device is not the Vision that runs on a Mac, so the
# host-side OCR suite cannot stand in for this. Requires a device in developer
# mode; pass its identifier as APOSITIFY_DEVICE_ID to choose between several.
set -euo pipefail

bash scripts/prepare-ios-device-specimens.sh

device_id="${APOSITIFY_DEVICE_ID:-}"
if [ -z "$device_id" ]; then
  device_id="$(xcrun devicectl list devices 2>/dev/null \
    | awk '$0 ~ /connected/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-/) { print $i; exit } }')"
fi
if [ -z "$device_id" ]; then
  echo "No connected iOS device found. Attach one in developer mode, or set APOSITIFY_DEVICE_ID." >&2
  exit 1
fi

echo "Running the specimen corpus on device $device_id"
echo "Keep the device unlocked: Xcode cannot launch the tests on a locked phone."

result_bundle="${TMPDIR:-/tmp}/apositify-ios-device.xcresult"
rm -rf "$result_bundle"

set +e
xcodebuild test \
  -project ios/Apositify.xcodeproj \
  -scheme Apositify \
  -destination "platform=iOS,id=$device_id" \
  -allowProvisioningUpdates \
  -resultBundlePath "$result_bundle" \
  -quiet
status=$?
set -e

if [ -d "$result_bundle" ]; then
  xcrun xcresulttool get test-results tests --path "$result_bundle" --compact 2>/dev/null \
    | python3 -c '
import json, sys

def walk(node):
    for child in node.get("children", []):
        yield from walk(child)
    if node.get("nodeType") == "Test Case":
        yield node

document = json.load(sys.stdin)
cases = [case for node in document.get("testNodes", []) for case in walk(node)]
for case in sorted(cases, key=lambda c: c["name"]):
    print(f"  {case.get("result", "?"):8} {case["name"]}")
passed = sum(1 for c in cases if c.get("result") == "Passed")
print(f"iOS device specimen tests: {passed} passed, {len(cases) - passed} not passed, {len(cases)} total")
' || echo "Could not summarize $result_bundle"
fi

exit $status
