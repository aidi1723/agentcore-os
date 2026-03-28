# AgentCore OS v1.2.0 发布检查清单

这份清单用于把当前工作区整理成可发布的 `v1.2.0` 版本。

当前默认发布口径：

- 版本：`v1.2.0`
- 安装方式：命令行安装 / 从源码运行
- 不承诺 DMG / EXE 安装包

## 1. 发布前检查

确认这些文件已经更新：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.lock`
- `README.md`
- `CHANGELOG.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`
- `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- `docs/USER_GUIDE.zh-CN.md`
- `docs/COMMAND_LINE_INSTALL.zh-CN.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `docs/releases/v1.2.0.md`
- `docs/releases/v1.2.0.zh-CN.md`
- `docs/releases/v1.2.0-github-release.zh-CN.md`
- `docs/LAUNCH_COPY_v1.2.0.zh-CN.md`

## 2. 本地校验

```bash
npm run test:stability
git status
```

## 3. 人工复核

发布前至少再看一遍：

- README 首页口径是否围绕 `v1.2.0`
- Release 文案是否没有承诺安装包
- 是否存在私人信息、真实密钥、临时日志、截图、测试数据
- 版本号是否统一为 `1.2.0`
- 中文文档是否同时包含 GitHub 与 CNB 入口
- 当前对外描述是否仍聚焦工作流闭环，而不是夸大为底层基础设施路线

## 4. 建议发布命令

如果你要本地提交并打 tag，可按这个顺序：

```bash
git status
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock README.md CHANGELOG.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/EARLY_ACCESS_RELEASE.zh-CN.md docs/USER_GUIDE.zh-CN.md docs/COMMAND_LINE_INSTALL.zh-CN.md docs/MACOS_UNSIGNED_INSTALL.zh-CN.md docs/MACOS_SIGNING_AND_NOTARIZATION.zh-CN.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md docs/LAUNCH_COPY_v1.2.0.zh-CN.md docs/RELEASE_CHECKLIST_v1.2.0.zh-CN.md docs/releases/v1.2.0.md docs/releases/v1.2.0.zh-CN.md docs/releases/v1.2.0-github-release.zh-CN.md
git commit -m "release: prepare v1.2.0"
git tag -a v1.2.0 -m "AgentCore OS v1.2.0"
git push origin main
git push origin v1.2.0
git push cnb main
git push cnb v1.2.0
```

建议继续用 `git status --short` 复核一次，确认没有把无关草稿或本地私有文件带进发版提交。

## 5. GitHub Release 建议

GitHub Release 页面建议：

- Tag: `v1.2.0`
- Title: `AgentCore OS v1.2.0`
- Body: 直接使用 `docs/releases/v1.2.0-github-release.zh-CN.md`

CNB 版本公告建议同样使用这份正文。

## 6. 发布后检查

发布完成后，检查：

- 仓库首页 README 是否渲染正常
- Release 页面链接是否正常
- 命令行安装步骤是否可直接复制执行
- `docs/releases/v1.2.0.zh-CN.md` 与 GitHub / CNB 发布正文是否一致
