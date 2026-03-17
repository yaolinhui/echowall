# KudosWall 🌟

> 轻量级社交证明工具——自动抓取全网好评，生成可嵌入网站的口碑墙

## 产品简介

**KudosWall** 是一款面向独立开发者、创作者和小型企业的社交证明工具。它能自动抓取 GitHub、Product Hunt、Twitter、知乎等平台上的正面评价，通过 AI 筛选后生成可嵌入网站的展示组件，帮助用户低成本建立信任、提升转化。

## 核心功能

- 🔍 **自动发现** - 定期扫描指定平台，发现提及作品的正面内容
- 🤖 **智能筛选** - AI 情感分析，自动过滤负面或中性评论
- 🎨 **便捷展示** - 生成 JS 代码，支持轮播、网格等多种样式
- 🔧 **开源托管** - 技术用户可自部署，非技术用户可选付费托管

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | NestJS (Node.js) + TypeScript |
| 数据库 | PostgreSQL + Redis |
| 前端 | React + Tailwind CSS |
| 队列 | Bull + Redis |
| AI | OpenAI API |

## 项目结构

```
KudosWall/
├── backend/          # NestJS 后端 API
├── frontend/         # React 前端管理后台
├── widget/           # 嵌入组件（原生 JS）
└── docker-compose.yml # 一键部署配置
```

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/kudoswall.git
cd kudoswall

# 2. 启动服务
docker-compose up -d

# 3. 访问 http://localhost:3000
```

## 开发文档

- [后端开发指南](./backend/README.md)
- [前端开发指南](./frontend/README.md)
- [API 文档](./docs/API.md)

## License

MIT License © 2026 KudosWall Team
