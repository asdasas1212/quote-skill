#!/usr/bin/env bash
# dev-unlink.sh — 解除本地链接，恢复到 npm 安装的版本
# 用法: npm run dev:unlink

set -e

CLI_DIR="packages/cli"

echo "🔓 解除本地 CLI 链接..."
cd "$CLI_DIR"
npm unlink --global @dalehkx/quote-cli 2>/dev/null || true
cd - > /dev/null

echo ""
echo "✅ 链接已解除"
echo "   如需恢复 npm 安装版本: npm install -g @dalehkx/quote-cli"
