# cass-quote

汽配询报价 CLI 工具，支持 Claude Code、Codex、Cursor、Cline 等主流 AI Agent。

## 安装

```bash
npx @dalehkx/quote-cli@latest install
```

一条命令完成：CLI 全局安装 + Skill 安装（多 Agent）+ 登录引导。

安装完成后，直接对你的 AI 工具说：

> 「帮我创建一条询价单」

## 手动安装

```bash
# 全局安装 CLI
npm install -g @dalehkx/quote-cli

# 安装 Skill（Claude Code、Codex、Cline 等）
npx skills add https://asdasas1212.github.io/quote-skill -y -g

# 登录
quote login
```

## 功能

- 创建询价单（支持 VIN 解析、多配件）
- 监听报价、比价分析
- 一键下单

## 开发

```bash
# 发版
npm run release          # patch
npm run release:minor    # minor
npm run release:major    # major
```
