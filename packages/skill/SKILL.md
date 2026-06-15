---
name: quote-skill
description: >-
  通用询报价管理技能。创建询价单、接收和管理报价、比价分析、确认下单。
  支持任何行业的询报价场景（汽配、工业品、IT采购等）。
  Use when the user wants to create an inquiry (RFQ), manage quotations,
  compare prices from multiple suppliers, or confirm purchase orders.
  Also use when the user mentions 询价、报价、比价、下单.
---

# Quote Skill

通用询报价管理工具，通过内置 CLI 实现完整的询价 → 报价 → 比价 → 下单流程。

## 环境准备

首次使用前，全局安装 CLI：

```bash
npm install -g @dalehkx/quote-cli
```

安装完成后即可直接使用 `quote` 命令：

```bash
quote <command>
```

## 命令参考

### 配置

设置当前用户角色和信息（首次使用时执行）：

```bash
quote config set --role buyer --name "张三" --company "XX修理厂"
quote config show
```

### 询价

```bash
# 创建询价单
quote inquiry create --product "刹车片" --oe "04465-33471" --vehicle "丰田凯美瑞 2020" --quantity 4

# 查看询价列表
quote inquiry list
quote inquiry list --status pending

# 查看详情
quote inquiry detail INQ-20260615-001

# 关闭询价
quote inquiry close INQ-20260615-001
```

### 报价

```bash
# 供应商对询价单报价
quote reply create --inquiry INQ-20260615-001 --price 280 --supplier "深圳XX汽配" --brand "天合TRW" --delivery 2

# 查看某询价单的所有报价
quote reply list --inquiry INQ-20260615-001
```

### 比价

```bash
# 按价格排序比较（默认）
quote compare --inquiry INQ-20260615-001

# 按货期排序
quote compare --inquiry INQ-20260615-001 --sort delivery
```

### 下单

```bash
# 选择报价确认下单
quote order confirm --inquiry INQ-20260615-001 --reply QUO-20260615-001

# 查看所有订单
quote order list
```

## 业务流程

典型使用流程：

1. 买方创建询价单（`inquiry create`）
2. 供应商报价（`reply create`，可多个供应商）
3. 买方比价（`compare`）
4. 买方选择最优报价下单（`order confirm`）

详细流程说明见 [references/workflow.md](references/workflow.md)。
数据结构定义见 [references/data-schema.md](references/data-schema.md)。

## 数据存储

所有数据存储在当前工作目录下的 `.quote-data/` 文件夹中（JSON 文件），无需外部数据库。
