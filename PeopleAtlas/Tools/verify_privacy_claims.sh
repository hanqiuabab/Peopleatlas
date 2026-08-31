#!/bin/bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$script_dir/.."
manifest="$project_dir/App/Resources/PrivacyInfo.xcprivacy"

if [[ ! -s "$manifest" ]]; then
  echo "Missing privacy manifest: $manifest" >&2
  exit 1
fi

tracking="$(plutil -extract NSPrivacyTracking raw -o - "$manifest")"
collected="$(plutil -extract NSPrivacyCollectedDataTypes json -o - "$manifest")"
tracking_domains="$(plutil -extract NSPrivacyTrackingDomains json -o - "$manifest")"
accessed_apis="$(plutil -extract NSPrivacyAccessedAPITypes json -o - "$manifest")"

if [[ "$tracking" != "false" || "$collected" != "[]" || "$tracking_domains" != "[]" ]]; then
  echo "Privacy manifest no longer matches the no-tracking/no-collection claim." >&2
  exit 1
fi

if [[ "$accessed_apis" != *'NSPrivacyAccessedAPICategoryUserDefaults'* || "$accessed_apis" != *'CA92.1'* ]]; then
  echo "Expected UserDefaults required-reason declaration is missing." >&2
  exit 1
fi

for pattern in \
  '^import (Contacts|AdSupport|AppTrackingTransparency|Network|WebKit)$' \
  'URLSession\b|dataTask\(' \
  'CNContactStore\b|ATTrackingManager\b|GADBannerView\b|FirebaseApp\b'; do
  if rg -n "$pattern" "$project_dir/App" --glob '*.swift'; then
    echo "Review privacy claims: a network, contacts, tracking, ads, or analytics API was found." >&2
    exit 1
  fi
done

entitlements="$project_dir/Config/PeopleAtlas.entitlements"
if [[ ! -s "$entitlements" ]] \
  || ! plutil -extract 'com\.apple\.developer\.icloud-container-identifiers' json -o - "$entitlements" | rg -q 'ATLAS_ICLOUD_CONTAINER_IDENTIFIER' \
  || ! plutil -extract 'com\.apple\.developer\.icloud-container-development-container-identifiers' json -o - "$entitlements" | rg -q 'ATLAS_ICLOUD_CONTAINER_IDENTIFIER' \
  || ! plutil -extract 'com\.apple\.developer\.icloud-container-environment' raw -o - "$entitlements" | rg -q 'ATLAS_CLOUDKIT_ENVIRONMENT' \
  || ! plutil -extract 'com\.apple\.developer\.icloud-services' json -o - "$entitlements" | rg -q 'CloudKit'; then
  echo "CloudKit entitlements are missing or inconsistent with the synchronization claim." >&2
  exit 1
fi

if ! rg -q 'cloudKitDatabase: cloudDatabase' "$project_dir/App/Data/AtlasRepository.swift" \
  || ! rg -q '\.private\(AtlasCloud\.containerIdentifier\)' "$project_dir/App/Data/AtlasRepository.swift"; then
  echo "SwiftData is no longer configured for the declared private CloudKit database." >&2
  exit 1
fi

if rg -n 'XCRemoteSwiftPackageReference|XCSwiftPackageProductDependency' "$project_dir/PeopleAtlas.xcodeproj/project.pbxproj"; then
  echo "Review privacy claims: a remote Swift package dependency was found." >&2
  exit 1
fi

echo "Privacy source preflight matches the current local-first/private-CloudKit, no-tracking, no-third-party-SDK claims."
