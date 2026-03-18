# 系统架构设计

## 1. 整体架构

EchoWall 采用经典的前后端分离架构：

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ React SPA   │  │ 管理后台    │  │ Widget 嵌入组件     │  │
│  │ (Vite)      │  │ (Dashboard) │  │ (Vanilla JS)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                           │ HTTP/REST API                    │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                         后端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ NestJS API  │  │ 业务逻辑    │  │ 数据持久化          │  │
│  │ Controller  │──▶│ Service     │──▶│ TypeORM + SQLite    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                           │ 导入/处理                        │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │                    数据处理层                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ JSON Parser │  │ HTML Parser │  │ Sentiment   │  │   │
│  │  │ (CWS/PH/GH) │  │ (App Store) │  │ Analysis    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心模块说明

### 2.1 前端层

#### 2.1.1 React 管理后台 (`frontend/`)

| 模块 | 职责 | 技术栈 |
|------|------|--------|
| `Dashboard` | 概览统计 | React + Tailwind CSS |
| `Projects` | 项目管理 | React Router |
| `Sources` | 数据源配置 | Form handling |
| `Mentions` | 评价管理（筛选/批准）| 列表 + 筛选 |
| `WidgetConfig` | 嵌入配置 | 代码生成器 |

#### 2.1.2 Widget 嵌入组件 (`widget/`)

```javascript
// 核心功能
- 接收配置参数（主题、布局、最大数量）
- 从后端 API 获取已批准的评价
- 渲染为轮播/网格/列表
- 响应式适配
```

### 2.2 后端层

#### 2.2.1 API 模块

```typescript
// 核心 Controller
- ProjectsController    # 项目管理
- SourcesController     # 数据源管理
- MentionsController    # 评价管理
- WidgetController      # Widget 数据提供
- ImportController      # 评价导入（新增）
```

#### 2.2.2 业务服务

```typescript
// 核心 Service
- ProjectsService       # 项目 CRUD
- SourcesService        # 数据源管理
- MentionsService       # 评价存储与筛选
- ImportService         # 导入解析（新增）
- WidgetService         # Widget 数据组装
```

#### 2.2.3 数据处理（新增模块）

```typescript
// 导入解析器
interface ReviewParser {
  parse(json: any): MentionData[];
}

class CWSReviewParser implements ReviewParser {
  parse(json: any): MentionData[] {
    // 解析 Chrome Web Store 评价格式
  }
}

class AppStoreReviewParser implements ReviewParser {
  parse(html: string): MentionData[] {
    // 解析 App Store HTML
  }
}
```

---

## 3. 数据流

### 3.1 评价导入流程

```
用户操作                    Bookmarklet                 后端处理
   │                           │                          │
   ▼                           ▼                          ▼
打开 CWS 页面 ──▶ 点击提取按钮 ──▶ 滚动页面加载评论
                                     │
                                     ▼
                              提取评价数据
                              [{
                                author: "...",
                                content: "...",
                                rating: 5,
                                date: "..."
                              }]
                                     │
                                     ▼
                              导出 reviews.json
                                     │
                                     ▼
上传文件 ───────────────────────────▶ 接收文件
                                         │
                                         ▼
                                    解析 JSON
                                         │
                                         ▼
                                    数据转换
                                    MentionData[]
                                         │
                                         ▼
                                    情感分析
                                    (正面/负面/中性)
                                         │
                                         ▼
                                    存入数据库
                                         │
                                         ▼
                                    返回成功
                                         │
                                         ▼
前端展示 ◀──────────────────────────────┘
在 Mentions 页面
看到导入的评价
```

### 3.2 Widget 嵌入流程

```
用户官网访客              Widget JS              EchoWall API
     │                      │                        │
     ▼                      ▼                        ▼
访问产品页 ──▶ 加载 widget.js ──▶ 请求评价数据
                                    GET /widget/{id}/data
                                                          │
                                                          ▼
                                                    查询数据库
                                                    已批准的评价
                                                          │
                                                          ▼
渲染评价列表 ◀──────────────────────────── 返回 JSON
[{
  content: "...",
  author: "...",
  rating: 5
}]
```

---

## 4. 数据库设计

### 4.1 核心实体

```typescript
// User - 用户
interface User {
  id: string;
  email: string;
  password: string;  // hashed
  name?: string;
  createdAt: Date;
}

// Project - 项目（一个产品）
interface Project {
  id: string;
  name: string;
  description?: string;
  website?: string;
  userId: string;
  widgetConfig: {
    theme: 'light' | 'dark';
    layout: 'carousel' | 'grid' | 'list';
    maxItems: number;
  };
  createdAt: Date;
}

// Source - 数据源（CWS、App Store 等）
interface Source {
  id: string;
  platform: 'chromewebstore' | 'appstore' | 'playstore' | 'producthunt' | 'github';
  name: string;
  config: {
    extensionId?: string;      // CWS
    appId?: string;            // App Store
    packageName?: string;      // Play Store
    postId?: string;           // Product Hunt
    repo?: string;             // GitHub
  };
  projectId: string;
  isActive: boolean;
  lastFetchedAt?: Date;
  createdAt: Date;
}

// Mention - 评价/提及（核心实体）
interface Mention {
  id: string;
  platform: string;
  externalId: string;        // 平台原始 ID
  content: string;           // 评价内容
  rawContent?: string;       // 原始内容（HTML）
  authorName: string;
  authorAvatar?: string;
  authorUrl?: string;        // 作者主页
  sourceUrl: string;         // 评价链接
  postedAt: Date;            // 评价时间
  
  // 新增字段
  rating?: number;           // 评分 1-5
  sentiment: 'positive' | 'negative' | 'neutral';  // 情感分析结果
  sentimentScore: number;    // 情感分数 0-1
  
  status: 'pending' | 'approved' | 'rejected';  // 审核状态
  isDeleted: boolean;
  
  metadata: {
    type?: string;
    [key: string]: any;      // 平台特定字段
  };
  
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 实体关系图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │   Project   │       │   Source    │
│─────────────│       │─────────────│       │─────────────│
│ id (PK)     │◀──────┤ userId (FK) │◀──────┤ projectId   │
│ email       │  1:N  │ id (PK)     │  1:N  │ id (PK)     │
│ password    │       │ name        │       │ platform    │
└─────────────┘       │ widgetConfig│       │ config      │
                      └─────────────┘       └─────────────┘
                              │
                              │ 1:N
                              ▼
                      ┌─────────────┐
                      │   Mention   │
                      │─────────────│
                      │ id (PK)     │
                      │ projectId   │
                      │ content     │
                      │ authorName  │
                      │ rating      │
                      │ sentiment   │
                      │ status      │
                      └─────────────┘
```

---

## 5. API 设计

### 5.1 导入 API

```typescript
// POST /api/mentions/import
// 导入评价数据

interface ImportMentionsDto {
  projectId: string;
  platform: string;  // 'chromewebstore' | 'appstore' | ...
  data: any;         // JSON 或 HTML 内容
}

interface ImportResponse {
  success: boolean;
  imported: number;      // 成功导入数量
  duplicates: number;    // 去重数量
  failed: number;        // 失败数量
  mentions: Mention[];   // 导入的评价列表
}
```

### 5.2 Widget API

```typescript
// GET /api/widget/:projectId/data
// 获取 Widget 展示数据

interface WidgetDataResponse {
  project: {
    name: string;
    widgetConfig: WidgetConfig;
  };
  mentions: Mention[];  // 只返回 approved 状态的评价
}
```

---

## 6. 安全考虑

| 风险 | 解决方案 |
|------|----------|
| XSS 攻击 | 前端使用 DOMPurify 清洗 HTML；Widget 使用 textContent |
| CSRF 攻击 | 使用 JWT Token；SameSite Cookie |
| 数据泄露 | 自托管，数据不出内网；敏感字段加密 |
| 恶意导入 | 限制文件大小；验证 JSON 结构；沙箱解析 |

---

## 7. 性能优化

| 场景 | 优化策略 |
|------|----------|
| 大量评价导入 | 使用 Bull 队列异步处理；分批插入数据库 |
| Widget 加载 | CDN 加速；数据缓存（Redis）；懒加载 |
| 图片加载 | 作者头像使用懒加载；失败时用默认头像 |

---

## 8. 技术栈总结

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18.x |
| 构建工具 | Vite | 5.x |
| 样式 | Tailwind CSS | 3.x |
| 后端框架 | NestJS | 10.x |
| 数据库 | SQLite | 3.x |
| ORM | TypeORM | 0.3.x |
| 队列 | Bull | 4.x |
| 缓存 | Redis | 7.x |

---

> 下一步: [数据流详细设计](./data-flow.md)
