# AgentCore OS 命令行安装说明

当前命令行安装说明已经收口到一个 canonical 路径：

- [GitHub macOS 命令行安装](GITHUB_MACOS_CLI_INSTALL.zh-CN.md)

当前对外只维护这一种安装格式：macOS 上从 GitHub 克隆源码，并通过命令行运行。

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

启动后访问：

```text
http://localhost:3000/
```

本页只作为旧入口的转向说明。后续安装步骤、要求和验证命令以 `docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md` 为准。
