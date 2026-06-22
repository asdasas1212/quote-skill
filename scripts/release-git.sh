#!/usr/bin/env bash
# release-git.sh — 升版本号、git commit + tag
# 用法: ./scripts/release-git.sh [patch|minor|major]
# 默认: patch
# 说明: 只操作 git，不涉及 npm 账户

set -e

BUMP=${1:-patch}
CLI_DIR="packages/cli"

# 验证参数
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "❌ 无效参数: $BUMP（只接受 patch / minor / major）"
  exit 1
fi

# 升版本号
echo "📦 升级版本号（$BUMP）..."
cd "$CLI_DIR"
NEW_VERSION=$(node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  const parts = pkg.version.split('.').map(Number);
  if ('$BUMP' === 'major') { parts[0]++; parts[1]=0; parts[2]=0; }
  else if ('$BUMP' === 'minor') { parts[1]++; parts[2]=0; }
  else parts[2]++;
  const v = parts.join('.');
  const content = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  content.version = v;
  require('fs').writeFileSync('package.json', JSON.stringify(content, null, 2) + '\n');
  process.stdout.write(v);
")
cd - > /dev/null

echo "✅ 新版本: $NEW_VERSION"

# git commit + tag
git add "$CLI_DIR/package.json"
git commit -m "chore: release @dalehkx/quote-cli@$NEW_VERSION"
git tag "v$NEW_VERSION"

echo ""
echo "🎉 Git 提交完成: v$NEW_VERSION"
echo "   推送到远端: git push && git push --tags"
echo "   发布到 npm: npm run release:npm"
