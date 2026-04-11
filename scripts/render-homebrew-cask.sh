#!/bin/sh

set -eu

if [ "$#" -ne 3 ]; then
  printf 'usage: %s <version> <arm64-zip> <tap-dir>\n' "$0" >&2
  exit 1
fi

VERSION=$1
ARM64_ZIP=$2
TAP_DIR=$3

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

CASK_NAME=${HOMEBREW_CASK_NAME:-jet-worktree}
ARM64_SHA=$(shasum -a 256 "$ARM64_ZIP" | awk '{print $1}')
RELEASE_URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/v${VERSION}"

mkdir -p "$TAP_DIR/Casks"

cat > "$TAP_DIR/Casks/${CASK_NAME}.rb" <<EOF
cask "${CASK_NAME}" do
  version "${VERSION}"
  sha256 "${ARM64_SHA}"

  url "${RELEASE_URL}/Jet-#{version}-arm64.zip"
  name "Jet"
  desc "Opinionated git worktree management"
  homepage "https://github.com/${GITHUB_REPOSITORY}"

  app "Jet.app"
  binary "#{appdir}/Jet.app/Contents/Resources/bin/jet"
end
EOF
