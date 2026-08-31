#!/bin/bash
# Keep test executables and reports outside Desktop/Documents/Downloads.
# This changes build placement only; it never grants or resets macOS permissions.
set -euo pipefail

atlas_mode="${1:-unit}"
atlas_destination="${2:-platform=macOS,arch=arm64}"
atlas_option="${3:-}"
atlas_project_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
atlas_temp_root="$(getconf DARWIN_USER_TEMP_DIR)"
atlas_cache="${atlas_temp_root%/}/PeopleAtlasQA"

case "$atlas_mode" in
    unit) atlas_action=(test -only-testing:PeopleAtlasTests) ;;
    ui) atlas_action=(test -only-testing:PeopleAtlasUITests) ;;
    smoke) atlas_action=(test -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testLargeTextEmptyStateAndEditor) ;;
    interactions) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testEditAndDeleteRelationshipThenDeletePerson
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testGraphFiltersCanRestoreAnIndividualRelationshipType) ;;
    graph) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testGraphFiltersCanRestoreAnIndividualRelationshipType
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testEveryGraphLayoutKeepsSelectionAndCanEnterFullScreen) ;;
    gestures) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testGraphPinchDragAndResetInEveryLayout
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testGraphSelectionPausesAndResumesRotationWithoutLosingManualPause) ;;
    appearance) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testAppearancePickerSwitchesLightDarkAndSystem) ;;
    accessibility) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testPrimaryScreensPassAccessibilityAudit) ;;
    privacy) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testPrivacyPolicyIsAvailableInBothLanguages) ;;
    store-shots) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testStoreScreenshotDrafts) ;;
    family) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testSmartFamilyConfirmationCanReturnCancelAndResolveEachQuestion
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testCertainFamilyConnectionsSaveWithoutConfirmation
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testBackupFilePickersCanCancelWithoutChangingData) ;;
    spouse) atlas_action=(test
        -only-testing:PeopleAtlasTests
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testAddingWifeAfterFatherCompletesMotherAndSonWithoutConfirmation) ;;
    backup) atlas_action=(test
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testBackupFilePickersCanCancelWithoutChangingData
        -only-testing:PeopleAtlasUITests/PeopleAtlasUITests/testBackupRoundTripRequiresExplicitReplacement) ;;
    all) atlas_action=(test) ;;
    build) atlas_action=(build-for-testing) ;;
    analyze) atlas_action=(analyze -configuration Release) ;;
    release) atlas_action=(build -configuration Release) ;;
    *) printf 'Usage: bash Tools/test.sh [unit|smoke|interactions|graph|gestures|appearance|accessibility|privacy|store-shots|family|spouse|backup|ui|all|build|analyze|release] [destination] [--dry-run]\n' >&2; exit 2 ;;
esac
if [[ -n "$atlas_option" && "$atlas_option" != "--dry-run" ]]; then
    printf 'Unknown option: %s\n' "$atlas_option" >&2; exit 2
fi
case "$atlas_destination" in
    *"platform=macOS"*)
        atlas_platform=macOS
        if [[ "$atlas_mode" == "release" || "$atlas_mode" == "analyze" ]]; then
            # Compilation checks cannot ad-hoc sign production iCloud entitlements.
            # A separate developer-signed build verifies the real capability/profile.
            atlas_signing=(CODE_SIGNING_ALLOWED=NO)
        else
            atlas_signing=(CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=)
        fi ;;
    *"platform=iOS Simulator"*) atlas_platform=iOS; atlas_signing=(CODE_SIGNING_ALLOWED=NO) ;;
    "generic/platform=iOS")
        if [[ "$atlas_mode" != "release" && "$atlas_mode" != "analyze" ]]; then
            printf 'A generic iOS destination is only supported for Release compilation or analysis.\n' >&2; exit 2
        fi
        atlas_platform=iOS-device; atlas_signing=(CODE_SIGNING_ALLOWED=NO) ;;
    *) printf 'Use local macOS, iOS Simulator, or generic iOS for Release compilation.\n' >&2; exit 2 ;;
esac

# Native file-picker tests currently exercise iPhone/iPad. Fail explicitly rather than
# letting xcodebuild report success after selecting zero tests on the Mac destination.
if [[ ( "$atlas_mode" == "backup" || "$atlas_mode" == "gestures" ) && "$atlas_platform" != "iOS" ]]; then
    printf 'Backup and touch-gesture UI tests require an explicit iOS Simulator destination.\n' >&2; exit 2
fi

# Stable per-user cache, separate platform build databases, unique non-overwriting reports.
atlas_derived="$atlas_cache/DerivedData-$atlas_platform"
atlas_report="$atlas_cache/Results/$atlas_platform-$atlas_mode-$(date +%Y%m%d-%H%M%S)-$$.xcresult"
# A test install must not share launch/restoration identity with the user's normal app.
# Release retains the developer-configured production identity and is never uploaded here.
atlas_command=(/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild
    -quiet -project "$atlas_project_dir/PeopleAtlas.xcodeproj" -scheme PeopleAtlas
    -destination "$atlas_destination" -derivedDataPath "$atlas_derived"
    -resultBundlePath "$atlas_report" -jobs 2 -parallel-testing-enabled NO
    "${atlas_signing[@]}" "${atlas_action[@]}")
if [[ "$atlas_mode" != "release" ]]; then
    # QA builds use an isolated local store and must not require or inherit production iCloud rights.
    atlas_command+=(ATLAS_BUNDLE_IDENTIFIER=com.peopleatlas.app.qa CODE_SIGN_ENTITLEMENTS=)
fi

printf 'Test products: %s\nTest report: %s\n' "$atlas_derived" "$atlas_report"
if [[ "$atlas_option" == "--dry-run" ]]; then
    printf '%q ' "${atlas_command[@]}"; printf '\n'; exit 0
fi
if [[ -L "$atlas_cache" ]]; then
    printf 'Refusing a symbolic-link test cache: %s\n' "$atlas_cache" >&2; exit 1
fi
mkdir -p "$atlas_cache/Results"
# Do not let a test process inherit Documents as its current working directory.
cd -- "$atlas_cache"
exec "${atlas_command[@]}"
