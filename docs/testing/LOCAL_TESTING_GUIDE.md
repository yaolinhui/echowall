# EchoWall 本地测试指南

> 本指南详细介绍如何在本地环境中运行 EchoWall 的所有测试

---

## 📋 前置要求

### 必需环境

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 20.x | 运行后端和前端 |
| npm | >= 10.x | 包管理 |
| Git | >= 2.x | 代码版本控制 |

### 可选工具

| 工具 | 用途 |
|------|------|
| Docker | 运行 PostgreSQL 和 Redis |
| k6 | 负载测试 |
| Playwright | E2E 测试 |

### 安装检查

```bash
# 检查 Node.js 版本
node -v  # 应显示 v20.x.x 或更高

# 检查 npm 版本
npm -v   # 应显示 10.x.x 或更高

# 检查 Git
git --version
```

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall
```

### 2. 安装依赖

```bash
# 方式一：使用 Makefile
make install

# 方式二：手动安装
cd backend && npm install
cd ../frontend && npm install
```

### 3. 配置环境变量（可选）

后端测试使用 SQLite 内存数据库，无需配置 PostgreSQL。如需测试完整功能：

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件配置数据库连接
```

---

## 🧪 运行测试

### 方式一：使用 Makefile（推荐）

```bash
# 运行所有测试（单元测试 + E2E）
make test

# 仅运行单元测试和集成测试
make test-unit

# 运行 E2E 测试（需要 Playwright）
make test-e2e

# 运行负载测试（需要 k6）
make test-load

# 查看测试覆盖率
make coverage
```

### 方式二：手动运行

#### 后端测试

```bash
cd backend

# 运行所有测试
npm test

# 仅运行单元测试（29个测试）
npm run test:unit

# 运行 E2E 测试（24个测试）
npm run test:e2e

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:cov

# CI 模式（带覆盖率）
npm run test:ci
```

#### 前端测试

```bash
cd frontend

# 运行所有测试（19个测试）
npm run test:run

# 监视模式（开发时使用）
npm test

# 带 UI 的测试模式
npm run test:ui

# 生成覆盖率报告
npm run test:cov
```

#### E2E 测试（Playwright）

```bash
# 安装 Playwright 浏览器
npx playwright install

# 运行 E2E 测试
npx playwright test

# 运行特定测试文件
npx playwright test e2e/auth.spec.ts

# 调试模式
npx playwright test --debug

# 生成测试报告
npx playwright show-report
```

---

## 📊 测试详情

### 后端单元测试（29个）

| 测试文件 | 测试内容 | 数量 |
|---------|---------|------|
| `users.service.spec.ts` | 用户服务 CRUD | 8 |
| `projects.service.spec.ts` | 项目服务 CRUD | 7 |
| `sources.service.spec.ts` | 数据源服务 | 7 |
| `github.adapter.spec.ts` | GitHub 适配器 | 7 |

运行：
```bash
cd backend && npm run test:unit
```

预期输出：
```
Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
```

### 后端 E2E 测试（24个，22个通过）

| 测试文件 | 测试内容 |
|---------|---------|
| `projects.e2e-spec.ts` | 项目 API 端点 |
| `mentions.e2e-spec.ts` | 提及 API 端点 |
| `widget.e2e-spec.ts` | 小部件 API |

运行：
```bash
cd backend && npm run test:e2e
```

### 前端组件测试（19个）

| 测试文件 | 测试内容 |
|---------|---------|
| `Modal.test.tsx` | Modal 组件 |
| `Dashboard.test.tsx` | Dashboard 页面 |
| `Projects.test.tsx` | Projects 页面 |

运行：
```bash
cd frontend && npm run test:run
```

预期输出：
```
Test Files  3 passed (3)
     Tests  19 passed (19)
```

---

## 🔧 测试配置说明

### 后端测试配置

**单元测试配置** (`backend/jest.config.js`):
- 使用 SQLite 内存数据库
- 自动同步实体
- 测试环境: Node.js

**E2E 测试配置** (`backend/jest.e2e.config.js`):
- 启动完整 NestJS 应用
- 使用 SQLite 内存数据库
- 测试真实 HTTP 请求

### 前端测试配置

**Vitest 配置** (`frontend/vitest.config.ts`):
- 使用 jsdom 环境
- MSW (Mock Service Worker) 模拟 API
- 支持 React Testing Library

---

## 🐛 常见问题

### 问题 1: SQLite 安装失败

**错误信息**：
```
npm ERR! sqlite3 build failed
```

**解决方案**：
```bash
# Windows
npm install --global windows-build-tools

# macOS
xcode-select --install

# Linux (Ubuntu/Debian)
sudo apt-get install build-essential python3
```

### 问题 2: 测试超时

**解决方案**：
```bash
# 增加超时时间
cd backend && npm run test:unit -- --testTimeout=30000
```

### 问题 3: 前端测试提示 act() 警告

**说明**：这是 React 测试的正常现象，我们已在测试中添加了 `waitFor` 处理。

如果仍然出现：
```bash
cd frontend && npm run test:run -- --reporter=verbose
```

### 问题 4: E2E 测试浏览器未安装

**解决方案**：
```bash
npx playwright install chromium
```

---

## 📈 测试覆盖率

### 查看覆盖率报告

```bash
# 后端
cd backend && npm run test:cov
# 报告位于: backend/coverage/lcov-report/index.html

# 前端
cd frontend && npm run test:cov
# 报告位于: frontend/coverage/index.html
```

### 当前覆盖率（参考）

| 模块 | 行覆盖率 |
|------|---------|
| UsersService | ~85% |
| ProjectsService | ~80% |
| SourcesService | ~75% |
| GithubAdapter | ~90% |

---

## 🔁 持续集成测试

项目使用 GitHub Actions 自动运行测试：

```yaml
# .github/workflows/ci.yml
- 每次 Push 自动运行
- 测试矩阵: Node.js 20.x
- 运行: 单元测试 + E2E 测试 + 构建检查
```

查看 CI 状态：[Actions 页面](https://github.com/yaolinhui/kudoswall/actions)

---

## 💡 编写新测试

### 后端单元测试示例

```typescript
// src/users/__tests__/users.service.spec.ts
describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, /* mock repositories */],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user', async () => {
    const dto = { email: 'test@example.com', password: '123456' };
    const result = await service.create(dto);
    expect(result.email).toBe(dto.email);
  });
});
```

### 前端组件测试示例

```typescript
// src/components/__tests__/MyComponent.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', async () => {
    render(<MyComponent />);
    await waitFor(() => {
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });
});
```

---

## 📞 获取帮助

如果测试遇到问题：

1. 查看 [GitHub Issues](https://github.com/yaolinhui/kudoswall/issues)
2. 检查 [CI 日志](https://github.com/yaolinhui/kudoswall/actions) 对比
3. 确保依赖已正确安装：`rm -rf node_modules && npm install`

---

**Happy Testing!** 🧪✨
