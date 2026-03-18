# EchoWall 项目文档

> 一个自托管的多平台用户评价聚合与展示系统

---

## 📖 项目概述

EchoWall 允许开发者：
1. **一键提取** 自己在各平台的真实用户评价（Chrome Web Store、App Store、Google Play、Product Hunt、GitHub）
2. **筛选管理** 好评（支持情感分析自动标记）
3. **嵌入展示** 到自己的官网/落地页

### 核心价值

| 特性 | 说明 |
|------|------|
| 🔒 **自托管** | 数据完全在自己手里，不依赖第三方 SaaS |
| 💰 **免费开源** | 无月费，对比 Testimonial ($20/月)、Browse AI ($19/月) |
| 🎯 **开发者友好** | 专注 CWS、App Store、Play Store 等开发者平台 |
| 🎨 **完全自定义** | 开源代码，可二次开发 |

---

## 🗂️ 文档目录

```
docs/
├── README.md                    # 本文档（项目总览）
├── architecture/               # 架构设计文档
│   ├── system-architecture.md  # 系统架构图与说明
│   ├── data-flow.md            # 数据流转图
│   └── database-schema.md      # 数据库设计
├── bookmarklet/                # Bookmarklet 使用文档
│   ├── user-guide.md           # 用户使用指南
│   └── development.md          # 开发文档
├── chrome-extension/           # Chrome 扩展文档
│   ├── user-guide.md           # 安装使用指南
│   └── development.md          # 扩展开发文档
├── api/                        # API 文档
│   └── import-api.md           # 评价导入 API
└── deployment/                 # 部署文档
    ├── local-development.md    # 本地开发环境
    ├── docker-deployment.md    # Docker 部署
    └── production-checklist.md # 生产环境检查清单
```

---

## 🚀 快速开始

### 用户视角（5 分钟上手）

```
1. 在 Chrome Web Store 打开自己的扩展页面
2. 点击书签栏的【提取评价】按钮
3. 下载 reviews.json 文件
4. 打开 EchoWall 后台，上传文件
5. 在 Mentions 页面看到所有评价
6. 点击【Get Embed Code】获取嵌入代码
7. 将代码粘贴到自己的官网 HTML 中
```

### 开发者视角（本地部署）

```bash
# 1. 克隆代码
git clone https://github.com/yaolinhui/echowall.git
cd echowall

# 2. 启动后端
cd backend
npm install
cp .env.example .env
npm run start:dev

# 3. 启动前端（新终端）
cd frontend
npm install
npm run dev

# 4. 访问 http://localhost:5173
```

---

## 📊 项目路线图

### Phase 1: 基础架构（已完成 ✅）
- [x] NestJS 后端框架
- [x] React 前端管理后台
- [x] SQLite 数据库
- [x] 用户/项目/数据源管理

### Phase 2: Bookmarklet 工具（当前 🔨）
- [ ] Chrome Web Store 评价提取
- [ ] App Store 评价提取
- [ ] Google Play 评价提取
- [ ] JSON 导出功能

### Phase 3: 后端导入 API（待开始 📋）
- [ ] 解析各平台 JSON/HTML
- [ ] 数据去重
- [ ] 情感分析（标记好评/差评）

### Phase 4: 前端筛选展示（待开始 📋）
- [ ] 评价列表筛选（按平台、评分、时间）
- [ ] 批量操作（批准/拒绝）
- [ ] 情感分析结果展示

### Phase 5: Widget 嵌入（待开始 📋）
- [ ] 生成嵌入代码
- [ ] 多种展示样式（轮播/网格/列表）
- [ ] 响应式设计

### Phase 6: Chrome 扩展（待开始 📋）
- [ ] 一键提取 + 自动上传到 EchoWall
- [ ] 支持多平台检测
- [ ] 可视化选择要导入的评价

---

## 🏗️ 系统架构

详见 [architecture/system-architecture.md](architecture/system-architecture.md)

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chrome Web  │  │ Bookmarklet │  │ Chrome Extension    │  │
│  │ Store 页面  │──▶│ 提取评价    │──▶│ (Phase 6)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EchoWall 后端服务                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Import API  │  │ 解析器      │  │ 情感分析服务        │  │
│  │ 接收评价    │──▶│ (CWS/AS/GP) │──▶│ (标记好评/差评)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ SQLite      │  │ Widget API  │  │ 筛选管理            │  │
│  │ 数据存储    │◀──│ 生成嵌入代码│──▶│ (批准/拒绝/展示)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    用户官网/落地页                            │
│              ┌──────────────────────────┐                   │
│              │   Embedded Widget        │                   │
│              │   (轮播/网格/列表展示)    │                   │
│              └──────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 各平台提取可行性

| 平台 | 可行性 | 技术方案 | 备注 |
|------|--------|----------|------|
| **Chrome Web Store** | ✅ 高 | Bookmarklet + 滚动加载 | 需要处理分页加载 |
| **App Store** | ✅ 中 | Bookmarklet + 页面解析 | 需要美区账号查看 |
| **Google Play** | ✅ 高 | 第三方库 `google-play-scraper` | 有现成 npm 包 |
| **Product Hunt** | ✅ 高 | 官方 API | 需要 Token |
| **GitHub** | ✅ 高 | 官方 API | 公开仓库无需认证 |
| **Twitter/X** | ❌ 低 | 官方 API $100/月 | 成本太高，暂不支持 |
| **知乎/小红书** | ❌ 低 | 强反爬+法律风险 | 暂不支持 |

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 `git checkout -b feature/amazing-feature`
3. 提交更改 `git commit -m 'Add amazing feature'`
4. 推送分支 `git push origin feature/amazing-feature`
5. 创建 Pull Request

---

## 📄 License

MIT License - 详见 [LICENSE](../LICENSE)

---

## 📞 联系方式

- GitHub Issues: [https://github.com/yaolinhui/echowall/issues](https://github.com/yaolinhui/echowall/issues)
- 项目文档: [https://github.com/yaolinhui/echowall/tree/master/docs](https://github.com/yaolinhui/echowall/tree/master/docs)

---

> **注意**: 本文档随项目迭代更新，建议定期查看最新版本。
