#!/usr/bin/env bash
set -euo pipefail

developer_path="$(xcode-select -p)"
sdk_path="$(xcrun --sdk macosx --show-sdk-path)"
command_line_tools_sdk="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"

if [[ "$developer_path" == *CommandLineTools* && -d "$command_line_tools_sdk" ]]; then
  sdk_path="$command_line_tools_sdk"
fi

module_cache_path="${TMPDIR:-/tmp}/apositify-sample-clang-cache"
test_binary_path="${TMPDIR:-/tmp}/apositify-ios-sample-tests"
official_cache_path="specimens/official-test-cache"
mkdir -p "$module_cache_path"

CLANG_MODULE_CACHE_PATH="$module_cache_path" swiftc \
  -sdk "$sdk_path" \
  -framework AppKit \
  -framework Vision \
  -framework ImageIO \
  ios/Apositify/Core/ApostilleModels.swift \
  ios/Apositify/Core/ApostilleParser.swift \
  ios/Apositify/Core/AuthorityMatcher.swift \
  ios/Apositify/Core/DirectorySearch.swift \
  ios/Apositify/Core/QrRouter.swift \
  ios/ApositifySampleTests/main.swift \
  -o "$test_binary_path"

"$test_binary_path" \
  ios/Apositify/Resources/e-registers.json \
  ios/ApositifySampleTests/sample-fixtures.json \
  ios/ApositifySampleTests/official-samples.json \
  "$official_cache_path"

required_failure_output="${TMPDIR:-/tmp}/apositify-required-ocr-failure.txt"
if APOSITIFY_FORCE_VISION_FAILURE=1 "$test_binary_path" \
  ios/Apositify/Resources/e-registers.json \
  ios/ApositifySampleTests/sample-fixtures.json >"$required_failure_output" 2>&1; then
  echo "FAIL: required OCR fixtures returned success when Vision was unavailable" >&2
  exit 1
fi
if ! grep -q "no required synthetic OCR fixture executed successfully" "$required_failure_output"; then
  echo "FAIL: required OCR failure did not report unsupported execution" >&2
  exit 1
fi
echo "Apositify required OCR execution gate passed"
