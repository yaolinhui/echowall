# KudosWall 🌟

[![CI](https://github.com/yaolinhui/kudoswall/actions/workflows/ci.yml/badge.svg)](https://github.com/yaolinhui/kudoswall/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://react.dev/)

> 🚀 **轻量级社交证明工具** —— 自动抓取全网好评，生成可嵌入网站的口碑墙

## 📖 产品简介

**KudosWall** 是一款面向独立开发者、创作者和小型企业的开源社交证明工具。它能自动从 GitHub、Product Hunt、Twitter、知乎、小红书等平台抓取正面评价，通过 AI 情感分析筛选后，生成可嵌入网站的展示组件，帮助用户低成本建立信任、提升转化。

### ✨ 核心特性

| 特性 | 描述 |
|------|------|
| 🔍 **多平台抓取** | 支持 GitHub、Product Hunt、Twitter、知乎、小红书等主流平台 |
| 🤖 **AI 情感分析** | 自动识别正面评价，过滤负面/中性内容 |
| 🎨 **多样化展示** | 轮播、网格、列表多种布局，支持自定义主题 |
| 📱 **响应式设计** | 完美适配桌面端和移动端 |
| 🔧 **开源自托管** | 技术用户可免费自部署，数据完全自主可控 |
| ⚡ **实时同步** | 基于 Redis 队列的异步任务调度，定时自动更新 |

---

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端 API** | NestJS + TypeScript | v10.x |
| **数据库** | PostgreSQL (生产) / SQLite (测试) | - |
| **缓存/队列** | Redis + Bull | - |
| **前端管理** | React + Tailwind CSS | v18.x |
| **嵌入组件** | 原生 JavaScript | ES6+ |
| **AI 分析** | OpenAI API / 自定义情感模型 | - |
| **测试** | Jest (后端) + Vitest (前端) | - |
| **E2E 测试** | Playwright | - |

---

## 📁 项目结构

```
KudosWall/
├── 📂 backend/              # NestJS 后端服务
│   ├── src/
│   │   ├── adapters/        # 平台适配器 (GitHub, ProductHunt...)
│   │   ├── users/           # 用户模块
│   │   ├── projects/        # 项目模块
│   │   ├── sources/         # 数据源模块
│   │   ├── mentions/        # 提及/评价模块
│   │   ├── widget/          # 小部件服务
│   │   └── fetcher/         # 定时抓取服务
│   └── test/                # E2E 测试
├── 📂 frontend/             # React 前端管理后台
│   ├── src/pages/           # Dashboard, Projects, Mentions...
│   └── src/components/      # 通用组件
├── 📂 widget/               # 可嵌入的口碑墙组件
├── 📂 e2e/                  # Playwright 端到端测试
├── 📂 tests/load/           # k6 负载测试脚本
└── 📂 docs/                 # 项目文档
```

---

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall

# 2. 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. 启动所有服务
docker-compose up -d

# 4. 访问应用
# 前端管理后台: http://localhost:3000
# 后端 API: http://localhost:3001/api
```

### 方式二：本地开发

```bash
# 1. 启动后端
cd backend
npm install
npm run start:dev

# 2. 启动前端（新终端）
cd frontend
npm install
npm run dev

# 3. 访问 http://localhost:5173
```

---

## 🧪 测试

项目包含完整的测试套件，确保代码质量和功能稳定性：

```bash
# 后端单元测试 (29 tests ✅)
cd backend && npm run test:unit

# 后端 E2E 测试 (22/24 tests ✅)
cd backend && npm run test:e2e

# 前端组件测试 (19 tests ✅)
cd frontend && npm run test:run

# 全部测试
make test
```

### 测试覆盖率

| 模块 | 行覆盖率 | 状态 |
|------|---------|------|
| UsersService | ~85% | ✅ |
| ProjectsService | ~80% | ✅ |
| SourcesService | ~75% | ✅ |
| GithubAdapter | ~90% | ✅ |

---

## 📚 文档

- [📘 后端开发指南](./backend/README.md)
- [📗 前端开发指南](./frontend/README.md)
- [🧪 测试报告](./docs/testing/TEST_REPORT_FINAL.md)
- [📋 API 文档](./docs/API.md)（待完善）
- [🏗️ 架构设计](./docs/ARCHITECTURE.md)（待完善）

---

## 🎯 功能模块

### 已实现 ✅

- [x] 用户注册/登录/管理
- [x] 项目创建与管理
- [x] 数据源配置 (GitHub, ProductHunt)
- [x] 提及内容自动抓取
- [x] AI 情感分析
- [x] 口碑墙小部件生成
- [x] 响应式管理后台
- [x] Docker 部署支持
- [x] CI/CD 自动化测试

### 开发中 🚧

- [ ] 更多平台适配器 (Twitter, 知乎, 小红书)
- [ ] 高级筛选与搜索
- [ ] 数据分析报表
- [ ] 付费订阅系统

---

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 开源协议

MIT License © 2026 [yaolinhui](https://github.com/yaolinhui)

---

## 🌟 Star History

如果这个项目对你有帮助，请给个 ⭐ 支持一下！

[![Star History Chart](https://api.star-history.com/svg?repos=yaolinhui/kudoswall&type=Date)](https://star-history.com/#yaolinhui/kudoswall&Date)
