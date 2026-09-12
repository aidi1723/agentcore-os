# 密钥管理指南

本文档说明 AgentCore OS 项目中如何安全地管理 API 密钥、环境变量和敏感配置。

---

## 🔐 核心原则

### ✅ 正确做法

1. **本地开发**: 使用 `.env.local`（已在 `.gitignore` 中排除）
2. **生产部署**: 使用环境变量或密钥管理服务
3. **CI/CD**: 使用 GitHub Secrets 或等效机制
4. **团队共享**: 使用 1Password、HashiCorp Vault 等工具

### ❌ 错误做法

- ❌ **永远不要**提交 `.env` 或包含真实密钥的文件到 git
- ❌ **永远不要**在代码中硬编码 API Key
- ❌ **永远不要**在日志、trace、错误消息中打印完整密钥
- ❌ **永远不要**在公开的 Issue/PR 中粘贴密钥

---

## 📝 配置示例

### 本地开发环境

```bash
# .env.local（本地开发，不提交到 git）
# 复制 .env.example 并填入真实值

# AI 模型 API Keys
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...

# 可选：本地 Connector 配置
WEBHOOK_SECRET=your-webhook-secret-here

# 可选：桌面 Sidecar 配置
SIDECAR_PORT=8787
```

### 生产环境

```bash
# 通过环境变量注入，不使用 .env 文件

# 方法 1: Shell 环境变量
export OPENAI_API_KEY="sk-proj-..."
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 方法 2: systemd 服务配置
# /etc/systemd/system/agentcore-os.service
[Service]
Environment="OPENAI_API_KEY=sk-proj-..."
Environment="ANTHROPIC_API_KEY=sk-ant-api03-..."

# 方法 3: Docker Compose
# docker-compose.yml
services:
  app:
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### CI/CD 环境

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - name: Run tests with secrets
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm run test
```

---

## 🔄 密钥轮换

建议每 **90 天**轮换一次 API Key，或在以下情况立即轮换：

- 密钥意外泄漏（提交到 git、粘贴到公开渠道）
- 团队成员离职
- 怀疑密钥被滥用

### 轮换流程

1. **生成新密钥**
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys

2. **更新所有环境**
   - 本地开发环境: 更新 `.env.local`
   - 生产环境: 更新环境变量
   - CI/CD: 更新 GitHub Secrets

3. **验证系统正常运行**
   ```bash
   npm run test:core-workflows
   npm run delivery:demo:check
   ```

4. **撤销旧密钥**
   - 在对应平台删除旧的 API Key

---

## 🛡️ 密钥泄漏防护

### Pre-commit Hook（推荐）

```bash
# 安装 git-secrets
brew install git-secrets  # macOS
# 或
apt-get install git-secrets  # Ubuntu

# 在项目中启用
cd agentcore-os
git secrets --install
git secrets --register-aws
git secrets --add 'sk-[a-zA-Z0-9]{48}'  # OpenAI 密钥格式
git secrets --add 'sk-ant-api03-[a-zA-Z0-9_-]{95}'  # Anthropic 密钥格式
```

### GitHub Actions 自动检测

项目已配置 TruffleHog 密钥扫描（见 `.github/workflows/security-audit.yml`）。

如果意外提交了密钥：
1. 立即轮换该密钥
2. 使用 `git filter-branch` 或 `BFG Repo-Cleaner` 从 git 历史中删除
3. 强制推送到远程仓库（警告：破坏性操作）

---

## 🔍 日志脱敏

在 Runtime Console 和 Governed Trace 中，已实现密钥脱敏：

```typescript
// src/lib/executor/runtime/trace-governance.ts
function sanitizeTrace(trace: ControlledRunTrace): SanitizedTrace {
  return {
    ...trace,
    steps: trace.steps.map(step => ({
      ...step,
      input: sanitizeApiKeys(step.input),
      output: sanitizeApiKeys(step.output)
    }))
  };
}

function sanitizeApiKeys(data: any): any {
  const patterns = [
    /sk-[a-zA-Z0-9]{48}/g,  // OpenAI
    /sk-ant-api03-[a-zA-Z0-9_-]{95}/g,  // Anthropic
  ];
  
  let str = JSON.stringify(data);
  patterns.forEach(pattern => {
    str = str.replace(pattern, '[REDACTED_API_KEY]');
  });
  
  return JSON.parse(str);
}
```

---

## 📚 推荐工具

### 本地开发

- **direnv**: 自动加载 `.envrc` 文件
- **pass**: Unix 密码管理器
- **1Password CLI**: 从 1Password 读取密钥

### 团队协作

- **1Password for Teams**: 团队密钥共享
- **HashiCorp Vault**: 企业级密钥管理
- **AWS Secrets Manager**: AWS 生态集成
- **Azure Key Vault**: Azure 生态集成

### CI/CD

- **GitHub Secrets**: GitHub Actions 原生支持
- **GitLab CI/CD Variables**: GitLab 原生支持
- **Doppler**: 跨平台密钥同步

---

## 🚨 意外泄漏应急响应

如果发现密钥泄漏：

1. **立即轮换密钥**（优先级最高）
2. **评估影响范围**
   - 检查 API 使用日志
   - 确认是否有异常调用
3. **从 git 历史中删除**
   ```bash
   # 使用 BFG Repo-Cleaner（推荐）
   brew install bfg
   bfg --replace-text passwords.txt agentcore-os.git
   
   # 或使用 git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```
4. **通知相关人员**
5. **记录事故报告**

---

## 🔗 相关文档

- [配置说明](CONFIGURATION.md)
- [部署说明](DEPLOYMENT.md)
- [安全政策](../SECURITY.md)
- [性能与安全改进建议](PERFORMANCE_SECURITY_IMPROVEMENTS.zh-CN.md)

---

**上次更新**: 2026-09-12  
**维护者**: AgentCore OS 安全团队
