# 性能与安全改进建议

本文档记录了从 2026-09-12 项目审核中发现的性能和安全相关问题，以及后续改进建议。

---

## 🔴 高优先级改进项

### 1. LLM 调用稳定性增强

**问题**: 步骤内的 LLM 调用可能失败、超时、返回格式不符，影响可控执行的可靠性。

**建议**:

```typescript
// src/lib/executor/llm-gateway.ts (待创建)

export interface LLMCallConfig {
  maxRetries: number;
  timeoutMs: number;
  fallbackStrategy: 'fail' | 'skip' | 'degraded';
  circuitBreakerThreshold: number;
}

export async function callLLMWithRetry(
  prompt: string,
  config: LLMCallConfig
): Promise<LLMResponse> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        callLLM(prompt),
        timeout(config.timeoutMs)
      ]);
      
      // 验证响应格式
      if (!validateLLMResponse(response)) {
        throw new Error('Invalid LLM response format');
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // 记录重试
      await logRetryAttempt({
        attempt,
        error,
        prompt: sanitize(prompt)
      });
      
      // 指数退避
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  
  // 所有重试失败后的降级策略
  return handleFallback(config.fallbackStrategy, lastError);
}
```

**实施建议**:
- [ ] 创建 `src/lib/executor/llm-gateway.ts` 统一 LLM 调用入口
- [ ] 实现重试、超时、熔断机制
- [ ] 在 `step-executor.ts` 中集成 gateway
- [ ] 补充 LLM 调用监控指标

---

### 2. 依赖安全审计自动化

**问题**: 虽然及时更新了 Next.js 安全补丁，但缺少持续的依赖漏洞扫描机制。

**建议**:

```yaml
# .github/workflows/security-audit.yml (待创建)

name: Security Audit

on:
  schedule:
    # 每周一早上 9 点运行
    - cron: '0 1 * * 1'
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm audit --production --audit-level=moderate
      
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

**实施建议**:
- [ ] 添加 `security-audit.yml` workflow
- [ ] 配置 Dependabot (`.github/dependabot.yml`)
- [ ] 集成 Snyk 或 Socket.dev
- [ ] 建立安全漏洞响应流程

---

### 3. Python Sidecar 签名验证

**问题**: 桌面版使用 PyInstaller 打包 Python sidecar，但未见签名验证机制。

**建议**:

```typescript
// src/lib/sidecar/verification.ts (待创建)

import * as crypto from 'crypto';
import * as fs from 'fs';

export async function verifySidecarIntegrity(
  sidecarPath: string,
  expectedHash: string
): Promise<boolean> {
  const fileBuffer = await fs.promises.readFile(sidecarPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  if (hash !== expectedHash) {
    throw new Error(
      `Sidecar integrity check failed. Expected ${expectedHash}, got ${hash}`
    );
  }
  
  return true;
}

// 在启动前验证
await verifySidecarIntegrity(
  './lobster-sidecar/dist/sidecar.exe',
  EXPECTED_SIDECAR_HASH // 从配置读取
);
```

**实施建议**:
- [ ] 生成 sidecar SHA-256 哈希并记录到配置文件
- [ ] 在 `desktop:prepare-sidecar` 后生成哈希
- [ ] 在启动时验证哈希
- [ ] 考虑使用代码签名证书（Windows/macOS）

---

## 🟡 中优先级改进项

### 4. 性能测试与负载测试

**问题**: 未见性能测试和负载测试证据，不清楚系统的性能瓶颈和容量上限。

**建议**:

```typescript
// src/__tests__/performance/controlled-runtime-load.test.ts (待创建)

import { describe, it, expect } from 'vitest';
import { runControlledPlaybook } from '@/lib/executor/core';

describe('Controlled Runtime Load Tests', () => {
  it('should handle 10 concurrent playbook runs', async () => {
    const startTime = Date.now();
    
    const runs = Array.from({ length: 10 }, (_, i) => 
      runControlledPlaybook({
        playbookId: 'sales-pipeline-v1',
        input: { dealId: `deal-${i}` }
      })
    );
    
    const results = await Promise.all(runs);
    const duration = Date.now() - startTime;
    
    expect(results.every(r => r.status === 'completed')).toBe(true);
    expect(duration).toBeLessThan(30000); // 30 秒内完成
  });
  
  it('should maintain trace store performance under load', async () => {
    // 测试 1000 次 trace 写入的性能
    const writes = Array.from({ length: 1000 }, (_, i) => 
      traceStore.write({ runId: `run-${i}`, event: 'test' })
    );
    
    const startTime = Date.now();
    await Promise.all(writes);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // 5 秒内完成
  });
});
```

**实施建议**:
- [ ] 创建 `src/__tests__/performance/` 目录
- [ ] 编写并发执行、trace 写入、asset 写回的负载测试
- [ ] 添加 `npm run test:performance` 命令
- [ ] 记录性能基线并监控退化

---

### 5. Trace Retention 容量规划

**问题**: 虽然有 retention preview 和 prune 命令，但缺少长期容量规划指南。

**建议**:

```markdown
# docs/TRACE_CAPACITY_PLANNING.zh-CN.md (待创建)

## Trace 数据增长模型

假设：
- 平均每次运行生成 100KB trace
- 每天运行 100 次
- 保留策略：30 天

**预估容量需求**:
- 日增长: 100 runs × 100KB = 10MB
- 30 天总量: 10MB × 30 = 300MB
- 年化增长（含索引开销）: ~5GB

## 推荐配置

### 小型部署（< 50 runs/day）
- 保留 30 天
- 最小终端运行数: 20
- 预估磁盘: < 1GB

### 中型部署（50-500 runs/day）
- 保留 90 天
- 最小终端运行数: 100
- 预估磁盘: 5-10GB

### 大型部署（> 500 runs/day）
- 保留 180 天
- 最小终端运行数: 500
- 预估磁盘: > 20GB
- 建议：定期归档到对象存储
```

**实施建议**:
- [ ] 创建容量规划文档
- [ ] 补充归档到 S3/OSS 的示例代码
- [ ] 添加磁盘使用监控指标

---

### 6. 环境变量和密钥管理规范

**问题**: 项目有 `.env.example` 但缺少密钥管理的最佳实践文档。

**建议**:

```markdown
# docs/SECRETS_MANAGEMENT.zh-CN.md (待创建)

## 密钥管理原则

### ✅ 正确做法

1. **本地开发**: 使用 `.env.local`（已在 .gitignore）
2. **生产部署**: 使用环境变量或密钥管理服务
3. **CI/CD**: 使用 GitHub Secrets
4. **团队共享**: 使用 1Password/Vault 等工具

### ❌ 错误做法

- 永远不要提交 `.env` 到 git
- 永远不要在代码中硬编码 API Key
- 永远不要在日志中打印完整密钥

## 示例配置

```bash
# .env.local (本地开发)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# 生产环境（使用环境变量）
export OPENAI_API_KEY="sk-..."
```

## 密钥轮换

建议每 90 天轮换一次 API Key：
1. 生成新 key
2. 更新环境变量
3. 验证系统正常运行
4. 撤销旧 key
```

**实施建议**:
- [ ] 创建密钥管理文档
- [ ] 添加 pre-commit hook 检测密钥泄漏
- [ ] 考虑集成 `git-secrets` 或 `detect-secrets`

---

## 🟢 低优先级改进项

### 7. 监控和告警框架

**问题**: 缺少生产级监控和告警机制。

**建议**:

```typescript
// src/lib/monitoring/metrics.ts (待创建)

export interface Metrics {
  playbookRunsTotal: Counter;
  playbookRunDuration: Histogram;
  llmCallsTotal: Counter;
  llmCallDuration: Histogram;
  approvalsPending: Gauge;
  traceStoreSize: Gauge;
}

// 集成 Prometheus 或自建指标收集
export function initMetrics() {
  return {
    playbookRunsTotal: new Counter('playbook_runs_total'),
    // ...
  };
}
```

**实施建议**:
- [ ] 评估监控方案（Prometheus, Datadog, etc.）
- [ ] 定义关键指标（KPIs）
- [ ] 实现指标收集 endpoint
- [ ] 创建 Grafana 仪表板示例

---

### 8. 文档搜索和索引

**问题**: 309 个文档文件缺少全文搜索，用户难以快速找到信息。

**建议**:

```bash
# 使用 Algolia DocSearch 或自建搜索索引

# 方案 1: 静态网站 + DocSearch
npm install @docsearch/js

# 方案 2: 本地全文搜索
npm install lunr

# 生成搜索索引
node scripts/build-docs-index.mjs
```

**实施建议**:
- [ ] 评估文档托管方案（GitHub Pages, Vercel, etc.）
- [ ] 集成搜索组件
- [ ] 添加文档版本切换器

---

## 📋 改进路线图

### Phase 1: 生产硬化（1-2 个月）
- [x] ~~版本口径统一~~（已完成）
- [x] ~~快速上手指南~~（已完成）
- [x] ~~文档分层导航~~（已完成）
- [ ] LLM 调用稳定性增强
- [ ] 依赖安全审计自动化
- [ ] Python Sidecar 签名验证

### Phase 2: 性能优化（2-3 个月）
- [ ] 性能测试与负载测试
- [ ] Trace Retention 容量规划
- [ ] 密钥管理规范

### Phase 3: 运维完善（3-6 个月）
- [ ] 监控和告警框架
- [ ] 文档搜索和索引
- [ ] 生产运维 Runbook

---

## 🔗 相关文档

- [项目审核报告](../PROJECT_AUDIT_REPORT.md)
- [审核执行摘要](../AUDIT_SUMMARY.md)
- [安全政策](../SECURITY.md)

---

**上次更新**: 2026-09-12  
**维护者**: AgentCore OS 核心团队
