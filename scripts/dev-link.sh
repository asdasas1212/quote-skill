#!/usr/bin/env bash
# dev-link.sh — 将本地 CLI 链接到全局，直接用 quote 命令测试本地代码
# 用法: npm run dev

set -e

CLI_DIR="packages/cli"

echo "🔗 链接本地 CLI 到全局..."
cd "$CLI_DIR"
npm link
cd - > /dev/null

echo ""
echo "✅ 完成！现在 quote 命令指向本地代码："
echo "   $(which quote) → $(readlink $(which quote) 2>/dev/null || ls -la $(which quote))"
echo ""
echo "📝 本地修改后直接执行 quote 即可生效（无需重新 link）"
echo "   解除链接: npm run dev:unlink"
