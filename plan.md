# quote-skill 重构方案：Adapter 模式

## 目标

将数据层抽象为 Adapter 接口，commands 只依赖统一接口，底层可切换：
- `local` — 当前本地 JSON 文件存储（默认）
- `api` — HTTP 接口调用（后续对接真实后端）

## 改动范围

```
scripts/cli/src/
├── adapter/
│   ├── index.mjs          # getAdapter() 工厂方法
│   ├── local.mjs          # LocalAdapter（包装现有 Store）
│   └── api.mjs            # ApiAdapter（HTTP 调用骨架）
├── commands/
│   ├── inquiry.mjs        # 改为调用 adapter.createInquiry() 等
│   ├── reply.mjs          # 改为调用 adapter.createReply() 等
│   ├── compare.mjs        # 改为调用 adapter.compareReplies()
│   ├── order.mjs          # 改为调用 adapter.confirmOrder() 等
│   └── config.mjs         # 新增 --mode / --api-base 选项
├── store.mjs              # 保留不变，被 LocalAdapter 内部使用
└── models.mjs             # 保留不变
```

## Adapter 统一接口

```js
class BaseAdapter {
  async createInquiry(data)          → record
  async listInquiries(filter)        → []
  async getInquiry(id)               → record | null
  async closeInquiry(id)             → record
  async createReply(data)            → record
  async listReplies(inquiryId)       → []
  async compareReplies(inquiryId, sort) → { inquiry, sorted, lowest, fastest }
  async confirmOrder(inquiryId, replyId) → record
  async listOrders()                 → []
  async getConfig()                  → {}
  async setConfig(updates)           → {}
}
```

## 切换方式

```bash
# 默认本地模式
quote config set --mode local

# 切换到 API 模式
quote config set --mode api --api-base "https://api.example.com/v1"
```

## 实现步骤

1. 创建 adapter/ 目录，实现 LocalAdapter（把现有 commands 里的逻辑搬过来）
2. 创建 ApiAdapter 骨架（方法预留，调用时提示"接口未配置"）
3. 创建 getAdapter() 工厂（读 config.mode 决定返回哪个）
4. 重构所有 commands 改为 `const adapter = getAdapter(); await adapter.xxx()`
5. config 命令新增 mode / apiBase 选项
6. 测试 local 模式功能不变
