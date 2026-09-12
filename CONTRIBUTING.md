# Contributing to AgentCore OS

感谢您对 AgentCore OS 的关注！我们欢迎各种形式的贡献。

---

## 🎯 如何贡献

### 报告 Bug

发现 Bug？请通过 [GitHub Issues](https://github.com/aidi1723/agentcore-os/issues) 报告。

**好的 Bug 报告应包含**：
- 清晰的标题
- 详细的问题描述
- 复现步骤
- 预期行为 vs 实际行为
- 环境信息（OS、Node.js 版本等）
- 截图或日志（如有）

### 提出功能请求

有好想法？欢迎通过 [GitHub Issues](https://github.com/aidi1723/agentcore-os/issues) 提出功能请求。

**好的功能请求应包含**：
- 清晰的标题
- 问题/需求描述
- 建议的解决方案
- 备选方案（如有）
- 使用场景

### 提交代码

1. **Fork 仓库**
   ```bash
   # Fork 后克隆到本地
   git clone https://github.com/YOUR_USERNAME/agentcore-os.git
   cd agentcore-os
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **进行更改**
   - 遵循代码规范
   - 添加测试（如适用）
   - 更新文档

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   # 或
   git commit -m "fix: fix your bug"
   ```

5. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   然后在 GitHub 上创建 Pull Request

---

## 📝 代码规范

### Commit 消息格式

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:
```
feat(runtime): add pipeline flow visualization

Add PipelineFlow component for visualizing playbook execution steps.

Co-Authored-By: Your Name <your.email@example.com>
```

### 代码风格

- 使用 TypeScript strict mode
- 遵循 ESLint 规则
- 运行 `npm run lint` 检查
- 运行 `npm run build` 验证构建

### 测试

- 添加单元测试（如适用）
- 运行 `npm test` 验证测试通过
- 保持高测试覆盖率

---

## 🔍 开发流程

### 设置开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- path/to/test
```

### 构建

```bash
# 生产构建
npm run build

# 启动生产服务器
npm start
```

---

## 📚 文档贡献

文档也非常重要！

### 文档位置
- 用户文档：`docs/`
- API 文档：`docs/api/`
- 架构文档：`docs/architecture/`

### 文档规范
- 使用 Markdown 格式
- 提供中英文双语（如可能）
- 包含代码示例
- 保持结构清晰

---

## 🤝 行为准则

### 我们的承诺

我们承诺为每个人提供友好、安全和受欢迎的环境。

### 我们的标准

**积极行为**：
- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

**不可接受行为**：
- 使用性化语言或图像
- 攻击性评论或人身攻击
- 公开或私下骚扰
- 未经许可发布他人隐私信息
- 其他不道德或不专业的行为

---

## 📞 联系方式

- **GitHub Issues**: https://github.com/aidi1723/agentcore-os/issues
- **GitHub Discussions**: https://github.com/aidi1723/agentcore-os/discussions

---

## 📄 许可证

贡献的代码将遵循项目的 GPL-3.0-or-later 许可证。

---

再次感谢您的贡献！🎉
