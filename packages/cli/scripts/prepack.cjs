#!/usr/bin/env node
// prepack: sync skills/cass-quote/ → packages/cli/skill/
// Runs from the monorepo root via `npm -w @dalehkx/quote-cli run prepack`
// or from packages/cli/ directly during `npm pack` / `npm publish`.

const fs = require('fs');
const path = require('path');

const cliDir = path.join(__dirname, '..');
const repoRoot = path.join(cliDir, '..', '..');
const skillSrc = path.join(repoRoot, 'skills', 'cass-quote');
const skillDest = path.join(cliDir, 'skill');

if (!fs.existsSync(skillSrc)) {
  console.error(`[prepack] skill source not found: ${skillSrc}`);
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync(skillDest)) {
  fs.rmSync(skillDest, { recursive: true });
}
copyDir(skillSrc, skillDest);
console.log(`[prepack] synced skills/cass-quote/ → packages/cli/skill/`);
