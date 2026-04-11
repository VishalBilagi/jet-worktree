#!/bin/sh

set -eu

if [ "$#" -ne 4 ]; then
  printf 'usage: %s <version> <arm64-zip> <x64-zip> <tap-dir>\n' "$0" >&2
  exit 1
fi

VERSION=$1
ARM64_ZIP=$2
X64_ZIP=$3
TAP_DIR=$4

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

CASK_NAME=${HOMEBREW_CASK_NAME:-jet-worktree}
ARM64_SHA=$(shasum -a 256 "$ARM64_ZIP" | awk '{print $1}')
X64_SHA=$(shasum -a 256 "$X64_ZIP" | awk '{print $1}')
RELEASE_URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/v${VERSION}"

mkdir -p "$TAP_DIR/Casks"

cat > "$TAP_DIR/Casks/${CASK_NAME}.rb" <<EOF
cask "${CASK_NAME}" do
  arch arm: "arm64", intel: "x64"

  version "${VERSION}"
  sha256 arm: "${ARM64_SHA}", intel: "${X64_SHA}"

  url "${RELEASE_URL}/Jet-#{version}-#{arch}.zip"
  name "Jet"
  desc "Opinionated git worktree management"
  homepage "https://github.com/${GITHUB_REPOSITORY}"

  app "Jet.app"
  binary "#{appdir}/Jet.app/Contents/Resources/bin/jet"
end
EOF
