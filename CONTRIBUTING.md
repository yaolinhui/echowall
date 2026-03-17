# Contributing to KudosWall

首先，感谢你考虑为 KudosWall 做出贡献！🎉

First off, thank you for considering contributing to KudosWall! 🎉

---

## 如何贡献 / How to Contribute

### 报告问题 / Reporting Issues

**中文**: 如果你发现了 bug 或有功能建议，请通过 [GitHub Issues](https://github.com/yaolinhui/kudoswall/issues) 提交。

**English**: If you find a bug or have a feature suggestion, please submit via [GitHub Issues](https://github.com/yaolinhui/kudoswall/issues).

提交问题时请包含：
- 问题描述（清晰简洁）
- 复现步骤
- 期望行为 vs 实际行为
- 环境信息（Node.js 版本、操作系统等）
- 相关代码片段或错误日志

When submitting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment info (Node.js version, OS, etc.)
- Relevant code snippets or error logs

### 提交代码 / Submitting Code

1. **Fork** 本仓库 / Fork this repository
2. **Clone** 你的 fork / Clone your fork
   ```bash
   git clone https://github.com/YOUR_USERNAME/kudoswall.git
   ```
3. **创建分支** / Create a branch
   ```bash
   git checkout -b feature/your-feature-name
   # 或 / or
   git checkout -b fix/issue-description
   ```
4. **提交更改** / Commit your changes
   ```bash
   git commit -m "feat: add amazing feature"
   ```
5. **推送** 到 fork / Push to your fork
   ```bash
   git push origin feature/your-feature-name
   ```
6. **创建 Pull Request** / Create a Pull Request

---

## 开发规范 / Development Guidelines

### 代码风格 / Code Style

- **后端**: 使用 ESLint + Prettier 配置
  ```bash
  cd backend && npm run lint
  cd backend && npm run format
  ```
- **前端**: 使用 ESLint 配置
  ```bash
  cd frontend && npm run lint
  ```

### 提交信息规范 / Commit Message Convention

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能）|
| `refactor` | 代码重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

示例：
```
feat: add Twitter adapter for fetching mentions
fix: resolve memory leak in fetcher service
docs: update API documentation for widget endpoint
```

### 测试要求 / Testing Requirements

所有代码提交前必须通过测试：

```bash
# 运行后端测试 / Run backend tests
cd backend && npm run test:unit
cd backend && npm run test:e2e

# 运行前端测试 / Run frontend tests
cd frontend && npm run test:run

# 或运行全部 / Or run all
make test
```

---

## 项目结构说明 / Project Structure

```
backend/
├── src/
│   ├── adapters/     # 平台适配器 / Platform adapters
│   ├── users/        # 用户模块 / User module
│   ├── projects/     # 项目模块 / Project module
│   ├── sources/      # 数据源模块 / Data source module
│   ├── mentions/     # 提及模块 / Mention module
│   ├── widget/       # 小部件服务 / Widget service
│   └── fetcher/      # 抓取服务 / Fetcher service
└── test/             # E2E 测试 / E2E tests

frontend/
├── src/
│   ├── pages/        # 页面组件 / Page components
│   ├── components/   # 通用组件 / Shared components
│   └── services/     # API 服务 / API services
└── ...
```

---

## 添加新平台适配器 / Adding New Platform Adapters

如果你想添加新的平台支持（如 Twitter、知乎、小红书），请参考以下步骤：

1. 在 `backend/src/adapters/` 创建新的适配器文件
2. 继承 `BaseAdapter` 类
3. 实现 `fetch()` 方法
4. 在 `AdaptersModule` 中注册
5. 添加单元测试
6. 更新文档

详细指南：[适配器开发文档](./docs/ADAPTER_DEVELOPMENT.md)（待完善）

---

## 代码审查流程 / Code Review Process

1. 所有 PR 都需要至少一个审查者批准
2. 确保 CI 检查通过
3. 审查者可能会提出修改建议
4. 修改完成后会合并到主分支

---

## 行为准则 / Code of Conduct

### 我们的承诺 / Our Pledge

我们致力于提供一个友好、安全和受欢迎的环境，无论：
- 年龄、体型、身体状况、种族、性别认同和表达
- 经验水平、教育背景、社会经济地位
- 国籍、个人外貌、种族、宗教信仰或性取向

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### 不可接受的行为 / Unacceptable Behavior

- 使用歧视性语言或图像
- 骚扰、侮辱/贬损性评论
- 个人或政治攻击
- 公开或私下骚扰
- 未经明确许可发布他人私人信息
- 其他违反职业操守的行为

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## 获取帮助 / Getting Help

- 查看 [文档](./docs/) / Check [Documentation](./docs/)
- 在 [Discussions](https://github.com/yaolinhui/kudoswall/discussions) 提问 / Ask in [Discussions](https://github.com/yaolinhui/kudoswall/discussions)
- 加入我们的社区（待建立）/ Join our community (coming soon)

---

再次感谢你的贡献！/ Thanks again for your contribution! 🙏
