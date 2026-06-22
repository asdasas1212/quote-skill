#!/usr/bin/env bash
# release.sh — 完整发布流程（git + npm）
# 用法: ./scripts/release.sh [patch|minor|major]
# 默认: patch

set -e

BUMP=${1:-patch}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/release-git.sh" "$BUMP"
bash "$SCRIPT_DIR/release-npm.sh"
