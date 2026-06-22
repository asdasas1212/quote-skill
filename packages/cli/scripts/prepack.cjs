#!/usr/bin/env node
// prepack: sync packages/skill/ → packages/cli/skill/
// Runs from the monorepo root via `npm -w @dalehkx/quote-cli run prepack`
// or from packages/cli/ directly during `npm pack` / `npm publish`.

const fs = require('fs');
const path = require('path');

// packages/cli/ → find packages/skill/ relative to monorepo root
const cliDir = path.join(__dirname, '..');
const repoRoot = path.join(cliDir, '..', '..');
const skillSrc = path.join(repoRoot, 'packages', 'skill');
const skillDest = path.join(cliDir, 'skill');

if (!fs.existsSync(skillSrc)) {
  console.error(`[prepack] skill source not found: ${skillSrc}`);
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // 불필요한 파일 제외
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 기존 skill 디렉토리 초기화 후 복사
if (fs.existsSync(skillDest)) {
  fs.rmSync(skillDest, { recursive: true });
}
copyDir(skillSrc, skillDest);
console.log(`[prepack] synced packages/skill/ → packages/cli/skill/`);
