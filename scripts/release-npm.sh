#!/usr/bin/env bash
# release-npm.sh — 发布当前版本到 npm，并全局安装
# 用法: ./scripts/release-npm.sh
# 说明: 读取 packages/cli/package.json 中的当前版本，直接发布
#       需要已登录 npm（npm login），git 操作已在 release-git.sh 完成

set -e

CLI_DIR="packages/cli"

# 读取当前版本（不修改）
CURRENT_VERSION=$(node -e "
  const pkg = JSON.parse(require('fs').readFileSync('$CLI_DIR/package.json','utf8'));
  process.stdout.write(pkg.version);
")

echo "🚀 发布 @dalehkx/quote-cli@$CURRENT_VERSION 到 npm..."

# 检查 npm 登录状态
if ! npm whoami &>/dev/null; then
  echo "❌ 未登录 npm，请先执行: npm login"
  exit 1
fi

echo "👤 当前 npm 用户: $(npm whoami)"

# 发布
npm publish --workspace=@dalehkx/quote-cli

# 全局安装最新版
echo "⬇️  全局安装 @dalehkx/quote-cli@$CURRENT_VERSION..."
npm install -g "@dalehkx/quote-cli@$CURRENT_VERSION" --prefer-online

echo ""
echo "🎉 完成！当前版本: $(quote --version 2>/dev/null || echo $CURRENT_VERSION)"
