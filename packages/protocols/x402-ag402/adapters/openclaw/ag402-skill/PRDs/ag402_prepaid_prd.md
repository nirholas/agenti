# ag402 预付费系统 PRD

## 1. Goal

实现买方预付费信用机制，支持"天数+次数"混合套餐，降低 gas 成本并支持高频 API 调用。

## 2. Why

- **痛点**：当前每次 x402 请求都需要链上支付，gas 成本高（~0.00025 USDC/次），高频调用不经济
- **价值**：预付费可将 gas 降低 99.9%，提升用户体验，支持 AI Agent 高频调用场景
- **用户**：AI Agent 开发者、自动化工作流、需要高频调用付费 API 的场景

## 3. What

### 功能需求

1. **预付费包购买**
   - 支持多种套餐（3天/7天/30天/1年/2年 + 对应调用次数）
   - 通过链上支付购买，生成 Credential

2. **买方预算池管理**
   - 本地 SQLite 存储预付费余额
   - 每次调用优先扣减预付费池
   - 支持余额查询、过期检查

3. **Credential 机制**
   - 购买后生成签名 Credential
   - 包含：buyer_address, package_id, remaining_calls, expires_at, signature

4. **卖方验证服务**
   - 验证 Credential 签名和有效期
   - 内存缓存避免重复验证
   - 验证通过则跳过链上支付

5. **回退机制**
   - 预付费用完或过期，自动切换标准 402 链上支付

### 成功标准

- [ ] 可购买预付费包（3/7/30天，100/500/1000次）
- [ ] 每次调用优先扣减预付费池
- [ ] 预付费用完自动回退 402
- [ ] 卖方可验证 Credential 有效性
- [ ] Gas 降低 99.9%

## 4. Context

### 依赖

- x402 协议（现有）
- ag402-core 库
- SQLite（本地存储）
- Solana USDC（支付链）

### 现有代码

- `skill.py` - 现有 OpenClaw Skill 实现
- `~/Documents/ag402/protocol/open402/spec.py` - x402 协议定义

### 文件结构

```
ag402-skill/
├── skill.py              # 现有主文件
├── prepaid_models.py     # 新增：数据模型
├── prepaid_client.py     # 新增：买方预算池
├── prepaid_server.py     # 新增：卖方验证
└── tests/
    └── test_prepaid.py  # 新增：测试
```

## 5. Implementation

### 数据模型

```python
# prepaid_models.py
@dataclass
class PrepaidPackage:
    package_id: str
    name: str              # "30天1000次"
    days: int
    calls: int
    price: float           # USDC
    created_at: datetime
    
@dataclass  
class PrepaidCredential:
    buyer_address: str
    package_id: str
    remaining_calls: int
    expires_at: datetime
    signature: str         # 卖方签名
    seller_address: str
    
@dataclass
class UsageLog:
    credential_id: str
    called_at: datetime
    api_endpoint: str
    status: str           # success/failed
```

### 买方流程

```
1. ag402 prepaid buy <package_id>
   → 链上支付 → 生成 Credential → 存入本地 SQLite
   
2. ag402 pay <url>
   → 检查预付费池
   → 有余额：扣减 Credential → 带 Credential 请求 → 成功
   → 无余额：走标准 402 流程
```

### 卖方流程

```
1. 收到请求 → 检查 X-Prepaid-Credential header
2. 有 Credential → 验证签名/有效期/次数
3. 验证通过 → 扣减次数 → 返回 200
4. 验证失败/无 Credential → 走标准 402
```

### 套餐定义

| 套餐 ID | 天数 | 调用次数 | 价格 (USDC) |
|---------|------|----------|-------------|
| p3d_100 | 3 | 100 | 1.5 |
| p7d_500 | 7 | 500 | 5.0 |
| p30d_1000 | 30 | 1000 | 8.0 |
| p365d_5000 | 365 | 5000 | 35.0 |
| p730d_10000 | 730 | 10000 | 60.0 |

## 6. Validation

- [ ] 单元测试通过
- [ ] 端到端购买 → 调用 → 扣减流程跑通
- [ ] 回退逻辑正常（预付费用完 → 402）
- [ ] 签名验证正确
- [ ] 过期检查正确
