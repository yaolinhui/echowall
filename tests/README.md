# Testing Guide

## 测试架构

```
KudosWall/
├── backend/
│   ├── src/**/__tests__/        # 单元测试
│   └── test/                    # E2E 测试
├── frontend/
│   └── src/**/__tests__/        # 组件测试
├── e2e/                         # Playwright E2E 测试
└── tests/load/                  # 性能/负载测试
```

## 运行测试

### 后端测试

```bash
cd backend

# 单元测试
npm run test:unit

# E2E 测试
npm run test:e2e

# 覆盖率
npm run test:cov
```

### 前端测试

```bash
cd frontend

# 运行测试
npm run test:run

# 覆盖率
npm run test:cov

# UI 模式
npm run test:ui
```

### E2E 测试

```bash
# 安装 Playwright
npx playwright install

# 运行测试
npx playwright test

# 调试模式
npx playwright test --headed
```

### 性能测试

```bash
# 安装 k6
brew install k6  # macOS
choco install k6 # Windows

# 运行负载测试
k6 run tests/load/api-load.js

# 运行压力测试
k6 run tests/load/stress-test.js

# 运行峰值测试
k6 run tests/load/spike-test.js

# 指定不同环境
k6 run -e BASE_URL=https://api.kudoswall.io tests/load/api-load.js
```

## 测试覆盖率目标

| 类型 | 目标覆盖率 | 工具 |
|------|-----------|------|
| 单元测试 | > 80% | Jest/Vitest |
| 集成测试 | API 全覆盖 | Supertest |
| E2E 测试 | 核心流程 | Playwright |
| 性能测试 | P95 < 200ms | k6 |

## CI/CD 集成

GitHub Actions 会自动运行：
- Lint 检查
- 单元测试
- 集成测试
- E2E 测试
- 安全扫描
- 构建 Docker 镜像
