#!/usr/bin/env bash
set -euo pipefail

ats_value="$(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoadsInWebContent' ios/Apositify/Resources/Info.plist 2>/dev/null || true)"
if [[ "$ats_value" == "true" ]]; then
  echo "FAIL: the branded verifier must not opt out of App Transport Security" >&2
  exit 1
fi

developer_path="$(xcode-select -p)"
sdk_path="$(xcrun --sdk macosx --show-sdk-path)"
command_line_tools_sdk="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"

# Some standalone Command Line Tools releases leave the default SDK symlink one
# patch ahead of their Swift compiler. The bundled 15.4 SDK is compatible with
# the Foundation-only core tests. Full Xcode installations use their active SDK.
if [[ "$developer_path" == *CommandLineTools* && -d "$command_line_tools_sdk" ]]; then
  sdk_path="$command_line_tools_sdk"
fi

module_cache_path="${TMPDIR:-/tmp}/apositify-clang-cache"
test_binary_path="${TMPDIR:-/tmp}/apositify-ios-core-tests"
mkdir -p "$module_cache_path"

CLANG_MODULE_CACHE_PATH="$module_cache_path" swiftc \
  -sdk "$sdk_path" \
  ios/Apositify/Core/ApostilleModels.swift \
  ios/Apositify/Core/ApostilleParser.swift \
  ios/Apositify/Core/AuthorityMatcher.swift \
  ios/Apositify/Core/FieldValidator.swift \
  ios/Apositify/Core/QrRouter.swift \
  ios/Apositify/Core/VerificationRouter.swift \
  ios/ApositifyTests/main.swift \
  -o "$test_binary_path"

"$test_binary_path" ios/Apositify/Resources/e-registers.json
