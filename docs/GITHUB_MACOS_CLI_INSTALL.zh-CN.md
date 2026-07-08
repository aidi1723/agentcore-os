# GitHub macOS 命令行安装

Last updated: 2026-07-08

本文档是当前对外安装的唯一推荐格式：

**在 macOS 上，从 GitHub 克隆源码，并通过命令行运行。**

## 基本要求

- macOS 13 或更新版本
- Git
- Node.js 22 LTS
- npm

项目允许 Node.js 20 到 24；对外说明默认推荐 Node.js 22 LTS。

## 安装与运行

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

启动后打开：

```text
http://localhost:3000/
```

## 验证命令

如果需要在本机做基础确认：

```bash
npm run test:stability
```

如果只想确认当前文档仍保持 GitHub macOS 命令行安装口径：

```bash
npm run release:github-macos-cli:check
```

## 当前边界

这条路径只定义源码克隆、本地依赖安装和本地开发服务启动。

它不代表生产发布完成，也不执行发布动作、上传动作、部署动作、外部写入、凭证使用或生产验证。
