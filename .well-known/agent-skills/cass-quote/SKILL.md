---
name: cass-quote
description: "汽配询报价管理技能，支持账号注册/登录、创建询价单（多配件/VIN解析）、按配件品质下询价单、监听报价、比价分析、下单。配件品质（--quality 参数）共 9 种：原厂(ORIGINAL_BRAND)、原厂非国内4S(ORIGINAL_CURRENCY)、原厂国内4S(ORIGINAL_INLAND_4S)、原厂再制造(ORIGINAL_OTHERS)、国际品牌(EXTERNAL_BRAND)、其他品牌(INTERNAL_BRAND)、拆车件(SECOND_HAND)、同质件(EQUIVALENT_BRAND)、其他(OTHER_BRAND)。Use when the user wants to create an inquiry (RFQ), manage quotations, compare or filter prices by part quality (OEM / brand / second-hand), or confirm purchase orders. Also use when the user mentions 询价、报价、比价、下单、刹车片、配件、原厂件、品牌件、二手件."
---

# Quote Skill

对接 casstime 平台的询报价 CLI 工具，实现完整的注册 → 询价 → 报价 → 比价 → 下单流程。

## 安装

```bash
# 安装
npx @dalehkx/quote-cli@latest install

# 卸载
npx @dalehkx/quote-cli@latest remove
```

## AI 操作说明

### 首次运行权限配置（仅第一次调用时执行）

读取 `~/.claude/settings.json`，检查 `permissions` 是否已包含 `"allow": ["Bash(quote *)"]`。
如果没有，在开始任何操作前，先询问用户（建议同意）：

> 为了让后续 `quote` 命令自动执行、无需每次确认，是否将其加入白名单？（推荐，只需重启一次 Claude Code 即可永久生效）

- 用户**同意**：写入 `~/.claude/settings.json`，然后告知「已写入，**请重启 Claude Code** 后重新调用 skill，之后所有操作无需再确认。」写入后停止本次流程。
- 用户**拒绝**：直接继续，后续每条 `quote` 命令需要用户手动确认。

### 登录

**先问用户偏好密码登录还是短信验证码登录。**

- **密码登录**：先向用户收集账号和密码，然后一次执行 `quote login -u <账号> -p <密码>`
- **短信验证码登录**：先执行 `quote login --sms --send-code -u <手机号>` 触发发码，等用户告知验证码后执行 `quote login --sms -u <手机号> --code <验证码>`

### 创建询价单

**执行前先向用户确认车辆品牌和车型**，再带参数执行避免进入交互式品牌选择：

```bash
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸
```

如果用户有 VIN 码，优先用 VIN 自动识别品牌车型：

```bash
quote inquiry create -p "刹车片" --vin LSVXZ25N0F2113381
```

**品质要求**：如果用户提到品质偏好，用 `--quality` 传对应的 qualityId（可多个，不传则使用平台默认）：

| qualityId | 平台显示名称 | 常见用户说法 |
|-----------|-------------|------------|
| ORIGINAL_BRAND | 原厂 | 原厂件、原厂的 |
| ORIGINAL_CURRENCY | 原厂(非国内4S) | 原装进口 |
| ORIGINAL_INLAND_4S | 原厂(国内4S) | 4S件、国产原厂 |
| ORIGINAL_OTHERS | 原厂再制造 | 再制造件 |
| EXTERNAL_BRAND | 国际品牌 | 国际品牌、进口品牌 |
| INTERNAL_BRAND | 其他品牌 | 国产品牌 |
| SECOND_HAND | 拆车件 | 二手件、拆车的 |
| EQUIVALENT_BRAND | 同质件 | 同质、副厂件 |
| OTHER_BRAND | 其他 | 其他 |

```bash
# 只要原厂件
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸 --quality ORIGINAL_BRAND

# 同时接受原厂和国际品牌
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸 --quality ORIGINAL_BRAND EXTERNAL_BRAND
```

### 展示询价列表

列表时**始终使用 `quote inquiry list -v`**，可一次返回车型、VIN、创建时间等完整字段，无需再逐条调 `detail`。

展示格式示例：

| 配件 | 车型 | 报价 | 单号 |
|------|------|------|------|
| 火花塞 | 华晨宝马 520Li | 0条 | B26061705034 |
| 火花塞 | 华晨宝马 520Li | 0条 | B26061704095 |

**当用户说「查某配件的报价」而存在多条同名询价单时**，不要让用户猜单号，主动问：
> 「你有 N 条火花塞询价单，车型都是 XXX，分别是 HH:MM 和 HH:MM 创建的，查哪一条？」

### 监听报价

用 CronCreate 每分钟轮询一次，有实价报价就停。不要用 `watch`——它是持续进程，agent 只能在退出后拿到输出，实时 stdout 不可见。

#### 标准流程

**第一步：立即检查一次**

```bash
quote inquiry detail <单号>
```

输出中出现 `关联报价 (N 条)` → 有实价报价（`listReplies` 已过滤 price=0 的占坑槽位），直接展示，不需要轮询。

**第二步：无报价，注册每分钟轮询**

```
CronCreate:
  cron: "*/1 * * * *"
  recurring: true
  prompt: "检查询价单 <单号> 报价（第 N 次，最多 30 次）：运行 quote inquiry detail <单号>，
           若出现"关联报价"则展示报价并 CronDelete <jobId> 停止轮询；
           若 N >= 30 则告知用户等待超时并 CronDelete <jobId>；
           否则等下次触发。"
```

- `*/1 * * * *` 每分钟触发，30 次 = 30 分钟上限
- prompt 里带入计数 N 和 jobId，agent 每次唤醒自己维护计数
- 发现报价或到达上限后 CronDelete 结束

**人工终端场景**（用户自己盯着终端）：
```bash
quote inquiry watch <单号> --timeout 300
```

### 下单

**先查地址和物流 code，再带参数执行，避免交互式等待：**

```bash
# 第一步：查收货地址（记录要用的 addressId）
quote order addresses

# 第二步：查报价的可用物流（记录 logisticsCode，★推荐 那条优先）
quote order logistics -i <单号> -r <报价ID>

# 第三步：带参下单
quote order confirm -i <单号> -r <报价ID> -a <addressId> -l <logisticsCode>
```

- `-l default` 或不传 `-l` 时自动使用推荐物流（`defaultLogisticsDTO`）；只有都没有推荐物流时才需要手动选
- 返回成功后提示用户到 casstime App 完成付款

---

## 命令参考

### 注册 / 登录

```bash
quote register          # 新用户注册
quote login             # 密码登录（交互式，见上方 AI 操作说明）
quote login --sms       # 短信验证码登录（交互式，见上方 AI 操作说明）
quote whoami            # 查看登录状态
quote logout            # 登出
```

### 创建询价单

```bash
# 指定品牌车型（推荐，避免交互）
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸

# 多配件一张单
quote inquiry create -p "刹车片" "机油滤芯" "雨刷" --brand VW --brand-name 大众 -m 朗逸

# 通过 VIN 自动识别品牌车型
quote inquiry create -p "刹车片" --vin LSVXZ25N0F2113381

# 附带 OE 号和数量
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -o 1K0615301 -q 2

# 指定品质要求，传 qualityId，可多个（ORIGINAL_BRAND ORIGINAL_CURRENCY ORIGINAL_INLAND_4S ORIGINAL_OTHERS EXTERNAL_BRAND INTERNAL_BRAND BRAND SECOND_HAND EQUIVALENT_BRAND OTHER_BRAND）
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸 --quality 原厂
quote inquiry create -p "刹车片" --brand VW --brand-name 大众 -m 朗逸 --quality 原厂 品牌
```

### 查看询价单

```bash
quote inquiry list                        # 所有询价单
quote inquiry list --status pending       # 待报价
quote inquiry list --status quoted        # 已报价
quote inquiry list --status ordered       # 已下单
quote inquiry detail <单号>               # 详情
quote inquiry watch <单号> --json --timeout 300      # AI 调用：有报价即退出
quote inquiry watch <单号> -i 10 --timeout 300      # 每10秒检查，最多等5分钟
```

### 查看报价 / 比价

```bash
quote reply list -i <单号>                    # 查看所有报价
quote compare -i <单号>                        # 比价（按价格排序，显示品质列）
quote compare -i <单号> --sort delivery        # 按货期排序
quote compare -i <单号> --sort quality         # 按品质排序

# 按配件质量过滤（可多选：原厂 原装 4S 外资 内资 品牌 二手 等效）
quote compare -i <单号> --quality ORIGINAL_BRAND         # 只看原厂件
quote compare -i <单号> --quality ORIGINAL_BRAND BRAND   # 看原厂件和品牌件
quote compare -i <单号> --quality SECOND_HAND --sort price  # 二手件按价格排
```

### 下单

**先查物流选项，再带参数执行，避免进入交互式选择：**

```bash
# 1. 查看收货地址（获取 addressId）
quote order addresses

# 2. 查看该报价的可用物流（获取 logisticsCode）
quote order logistics -i <单号> -r <报价ID>

# 3. 带参下单（非交互）
quote order confirm -i <单号> -r <报价ID> -a <addressId> -l <logisticsCode>
```

如果用户想交互式选择，也可以直接运行（会依次提示选地址、选物流）：

```bash
quote order confirm -i <单号> -r <报价ID>
```

```bash
quote order list         # 查看订单列表（维修厂所有人的订单）
quote order list --mine  # 只查看当前登录账号下的订单
```

## 账号说明

| 状态 | 说明 |
|------|------|
| 未注册 | 执行 `quote register` 完成注册 + 公司信息填写 |
| 已注册未认证 | 有 5 次免费询价额度，超出报错"询价次数已用完" |
| 已认证 | 无限询价，支持简易询价接口 |

注册后需在 casstime APP 或平台完成企业认证，解锁无限询价：https://ec-hwbeta.casstime.com

## Token 自动续签

CLI 内部已处理 token 续签，**无需手动干预**：

| 场景 | 处理方式 |
|------|----------|
| token 距过期不足 5 分钟 | 发请求前同步刷新，取到新 token 再发 |
| token 本地记录已过期 | 阻塞刷新后重试 |
| 服务端返回 401 / 652 / 653 / 654 | 自动 refresh + 重试一次 |
| refresh token 也失效 | 清空凭证，报错提示 `quote login` |

code agent 遇到 `"请重新登录"` 错误时，说明 refresh token 也已失效（如长时间未使用、在其他设备退出），需执行一次 `quote login` 重新授权。

## 数据存储

配置和 Token 存储在 `~/.quote/config.json`，全局唯一，不受工作目录影响。
