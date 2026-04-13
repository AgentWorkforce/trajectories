#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="release"
SKIP_DMG="false"
INFO_PLIST_SOURCE="Sources/Info.plist"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --skip-dmg)
      SKIP_DMG="true"
      shift 1
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

case "${MODE}" in
  local|release) ;;
  *)
    echo "Invalid mode: ${MODE}. Expected 'local' or 'release'." >&2
    exit 1
    ;;
esac

if [[ "${MODE}" == "local" ]]; then
  BUILD_CONFIGURATION="debug"
  APP_NAME="Trail Viewer Local"
  APP_BUNDLE_ID="com.agentworkforce.trailviewer.local"
  DMG_NAME="Trail-Viewer-local"
  OUTPUT_DIR="${PROJECT_DIR}/build/local"
else
  BUILD_CONFIGURATION="release"
  APP_NAME="Trail Viewer"
  APP_BUNDLE_ID="com.agentworkforce.trailviewer"
  DMG_NAME="Trail-Viewer"
  OUTPUT_DIR="${PROJECT_DIR}/build"
fi

BUNDLE_DIR="${OUTPUT_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${BUNDLE_DIR}/Contents"
EXECUTABLE_PATH=".build/${BUILD_CONFIGURATION}/TrailViewer"
DMG_PATH="${OUTPUT_DIR}/${DMG_NAME}.dmg"
STAGE_DIR="${OUTPUT_DIR}/dmg-stage"

echo "==> Building Trail Viewer (${MODE}, ${BUILD_CONFIGURATION})..." >&2
cd "${PROJECT_DIR}"
swift build -c "${BUILD_CONFIGURATION}"

if [[ ! -f "${EXECUTABLE_PATH}" ]]; then
  echo "Built executable not found at ${PROJECT_DIR}/${EXECUTABLE_PATH}" >&2
  exit 1
fi

echo "==> Creating .app bundle..." >&2
rm -rf "${BUNDLE_DIR}"
mkdir -p "${CONTENTS_DIR}/MacOS"
mkdir -p "${CONTENTS_DIR}/Resources"

cp "${EXECUTABLE_PATH}" "${CONTENTS_DIR}/MacOS/TrailViewer"
cp "${INFO_PLIST_SOURCE}" "${CONTENTS_DIR}/Info.plist"
echo -n "APPL????" > "${CONTENTS_DIR}/PkgInfo"

if [[ "${MODE}" == "local" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "${CONTENTS_DIR}/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${APP_NAME}" "${CONTENTS_DIR}/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ${APP_BUNDLE_ID}" "${CONTENTS_DIR}/Info.plist"
fi

echo "==> Validating bundle metadata..." >&2
plutil -lint "${CONTENTS_DIR}/Info.plist" >&2
EXECUTABLE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "${CONTENTS_DIR}/Info.plist")"
if [[ "${EXECUTABLE_NAME}" != "TrailViewer" ]]; then
  echo "Expected CFBundleExecutable to be TrailViewer, got: ${EXECUTABLE_NAME}" >&2
  exit 1
fi

if [[ "${MODE}" == "local" ]]; then
  echo "==> Code signing local bundle..." >&2
  codesign --force --sign - --deep "${BUNDLE_DIR}"
fi

if [[ "${SKIP_DMG}" == "false" ]]; then
  echo "==> Creating DMG..." >&2
  rm -rf "${STAGE_DIR}"
  mkdir -p "${STAGE_DIR}"
  cp -R "${BUNDLE_DIR}" "${STAGE_DIR}/"
  ln -s /Applications "${STAGE_DIR}/Applications"

  hdiutil create -volname "${APP_NAME}" \
    -srcfolder "${STAGE_DIR}" \
    -ov -format UDZO \
    "${DMG_PATH}" >&2

  rm -rf "${STAGE_DIR}"
fi

printf '%s\n' "${BUNDLE_DIR}"
