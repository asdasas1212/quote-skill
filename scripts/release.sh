#!/usr/bin/env bash
# 用法: ./scripts/release.sh [patch|minor|major]
set -e

BUMP=${1:-patch}
CLI_DIR="packages/cli"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "❌ 无效参数: $BUMP（只接受 patch / minor / major）"
  exit 1
fi

if ! npm whoami &>/dev/null; then
  echo "❌ 未登录 npm，请先执行: npm login"
  exit 1
fi

# 升版本号
NEW_VERSION=$(node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$CLI_DIR/package.json','utf8'));
  const p = pkg.version.split('.').map(Number);
  if ('$BUMP'==='major'){p[0]++;p[1]=0;p[2]=0;}
  else if ('$BUMP'==='minor'){p[1]++;p[2]=0;}
  else p[2]++;
  pkg.version = p.join('.');
  fs.writeFileSync('$CLI_DIR/package.json', JSON.stringify(pkg,null,2)+'\n');
  process.stdout.write(pkg.version);
")

echo "🚀 发布 @dalehkx/quote-cli@$NEW_VERSION"

git add "$CLI_DIR/package.json"
git commit -m "chore: release @dalehkx/quote-cli@$NEW_VERSION"
git tag "v$NEW_VERSION"

npm publish --workspace=@dalehkx/quote-cli

git push && git push --tags

echo "✅ 完成: v$NEW_VERSION"
