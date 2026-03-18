# Bookmarklet 开发文档

## 📁 文件位置

```
backend/
├── src/
│   └── bookmarklet/
│       ├── bookmarklet.controller.ts      # API 端点
│       ├── bookmarklet.service.ts         # 服务逻辑
│       └── templates/
│           ├── cws-extractor.js           # CWS 提取脚本
│           ├── appstore-extractor.js      # App Store 提取脚本
│           └── playstore-extractor.js     # Play Store 提取脚本
public/
└── bookmarklet/                           # 静态文件（通过 CDN 分发）
    ├── cws-extractor.min.js
    ├── appstore-extractor.min.js
    └── playstore-extractor.min.js
```

---

## 🏗️ 架构设计

### 为什么用服务器托管 JS 文件？

**方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **代码直接放书签** | 无需服务器 | 代码太长（URL 有限制）；无法更新 |
| **服务器托管 JS** | 可更新；代码可压缩 | 需要网络请求 |

**选择**：服务器托管 JS（可维护性优先）

### 工作流程

```
用户点击 Bookmarklet
        │
        ▼
注入一段极简代码（loader）
        │
        ▼
loader 从服务器加载完整提取脚本
        │
        ▼
完整脚本执行：
  1. 检测当前平台
  2. 滚动加载所有评论
  3. 提取数据
  4. 生成 JSON
  5. 触发下载
```

---

## 📝 Chrome Web Store 提取脚本详解

### 核心逻辑

```javascript
// cws-extractor.js
(function() {
  'use strict';
  
  // ========== 配置 ==========
  const CONFIG = {
    scrollDelay: 800,        // 滚动间隔（毫秒）
    maxScrollAttempts: 50,   // 最大滚动次数
    reviewSelector: '.ba-bc-Xb',  // 评论元素选择器
  };
  
  // ========== 状态管理 ==========
  const state = {
    reviews: [],
    scrollCount: 0,
    isComplete: false,
  };
  
  // ========== 工具函数 ==========
  
  /**
   * 延迟函数
   */
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  /**
   * 滚动到页面底部
   */
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  };
  
  /**
   * 提取单条评论数据
   */
  const extractReview = (element) => {
    try {
      const author = element.querySelector('.Y2CD1e')?.textContent?.trim();
      const content = element.querySelector('.M6EbCf')?.textContent?.trim();
      const ratingText = element.querySelector('.NtbGnb')?.getAttribute('aria-label');
      const rating = ratingText ? parseInt(ratingText.match(/\d/)?.[0] || '0') : 0;
      const date = element.querySelector('.s7IdQd')?.textContent?.trim();
      const helpful = element.querySelector('.zhVBKd')?.textContent?.match(/\d+/)?.[0];
      
      return {
        id: `cws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        author: author || 'Anonymous',
        content: content || '',
        rating,
        date,
        helpful: helpful ? parseInt(helpful) : 0,
        sourceUrl: window.location.href,
      };
    } catch (e) {
      console.error('提取评论失败:', e);
      return null;
    }
  };
  
  /**
   * 提取所有可见评论
   */
  const extractAllVisibleReviews = () => {
    const elements = document.querySelectorAll(CONFIG.reviewSelector);
    const reviews = [];
    
    elements.forEach(el => {
      const review = extractReview(el);
      if (review && review.content) {
        // 去重检查
        const isDuplicate = state.reviews.some(r => 
          r.content === review.content && r.author === review.author
        );
        if (!isDuplicate) {
          reviews.push(review);
        }
      }
    });
    
    return reviews;
  };
  
  /**
   * 检查是否还有更多评论
   */
  const hasMoreReviews = () => {
    // CWS 显示 "Show more" 按钮时表示还有更多
    const loadMoreBtn = document.querySelector('.VfPpkd-vQzf8d');
    if (loadMoreBtn && loadMoreBtn.textContent.includes('Show more')) {
      return true;
    }
    
    // 或者页面高度还在增加
    const currentHeight = document.body.scrollHeight;
    delay(500).then(() => {
      return document.body.scrollHeight > currentHeight;
    });
  };
  
  // ========== 主流程 ==========
  
  /**
   * 自动滚动并提取
   */
  const autoScrollAndExtract = async () => {
    console.log('🚀 开始提取 Chrome Web Store 评价...');
    
    // 显示进度 UI
    showProgressUI();
    
    while (state.scrollCount < CONFIG.maxScrollAttempts) {
      // 提取当前可见评论
      const newReviews = extractAllVisibleReviews();
      state.reviews.push(...newReviews);
      
      updateProgressUI(state.reviews.length);
      
      // 滚动页面
      scrollToBottom();
      await delay(CONFIG.scrollDelay);
      
      state.scrollCount++;
      
      // 检查是否已加载完
      if (!hasMoreReviews()) {
        console.log('✅ 所有评论已加载');
        break;
      }
    }
    
    // 完成
    state.isComplete = true;
    finalizeExtraction();
  };
  
  /**
   * 显示进度 UI
   */
  const showProgressUI = () => {
    const div = document.createElement('div');
    div.id = 'cws-extractor-ui';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1a73e8;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    div.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">📦 EchoWall 提取器</h3>
      <p id="cws-extractor-status">正在提取评价...</p>
      <p id="cws-extractor-count">已提取: 0 条</p>
    `;
    document.body.appendChild(div);
  };
  
  /**
   * 更新进度 UI
   */
  const updateProgressUI = (count) => {
    const countEl = document.getElementById('cws-extractor-count');
    if (countEl) {
      countEl.textContent = `已提取: ${count} 条`;
    }
  };
  
  /**
   * 完成提取
   */
  const finalizeExtraction = () => {
    // 获取扩展信息
    const extensionName = document.querySelector('.e8ssDc')?.textContent?.trim() || 'Unknown';
    const extensionId = window.location.pathname.match(/\/detail\/[^/]+\/([^/?]+)/)?.[1] || '';
    
    // 构建输出数据
    const output = {
      platform: 'chromewebstore',
      extensionId,
      extensionName,
      extractedAt: new Date().toISOString(),
      totalReviews: state.reviews.length,
      reviews: state.reviews,
    };
    
    // 下载 JSON
    downloadJSON(output, `${extensionId}-reviews-${Date.now()}.json`);
    
    // 更新 UI
    const statusEl = document.getElementById('cws-extractor-status');
    if (statusEl) {
      statusEl.textContent = `✅ 完成！已提取 ${state.reviews.length} 条评价`;
    }
    
    // 3 秒后移除 UI
    setTimeout(() => {
      document.getElementById('cws-extractor-ui')?.remove();
    }, 3000);
  };
  
  /**
   * 下载 JSON 文件
   */
  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // 启动
  autoScrollAndExtract();
})();
```

---

## 🔧 后端 API 实现

### Controller

```typescript
// bookmarklet.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { BookmarkletService } from './bookmarklet.service';

@Controller('api/bookmarklet')
export class BookmarkletController {
  constructor(private readonly service: BookmarkletService) {}

  @Get('cws-extractor.js')
  async getCWSExtractor(@Res() res: Response) {
    const script = await this.service.getCWSExtractorScript();
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(script);
  }

  @Get('appstore-extractor.js')
  async getAppStoreExtractor(@Res() res: Response) {
    const script = await this.service.getAppStoreExtractorScript();
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(script);
  }

  @Get('playstore-extractor.js')
  async getPlayStoreExtractor(@Res() res: Response) {
    const script = await this.service.getPlayStoreExtractorScript();
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(script);
  }
}
```

### Service

```typescript
// bookmarklet.service.ts
import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class BookmarkletService {
  private readonly scriptPath = join(__dirname, 'templates');

  async getCWSExtractorScript(): Promise<string> {
    const script = await readFile(
      join(this.scriptPath, 'cws-extractor.js'),
      'utf-8'
    );
    // 压缩代码（移除注释、空格）
    return this.minifyScript(script);
  }

  async getAppStoreExtractorScript(): Promise<string> {
    const script = await readFile(
      join(this.scriptPath, 'appstore-extractor.js'),
      'utf-8'
    );
    return this.minifyScript(script);
  }

  async getPlayStoreExtractorScript(): Promise<string> {
    const script = await readFile(
      join(this.scriptPath, 'playstore-extractor.js'),
      'utf-8'
    );
    return this.minifyScript(script);
  }

  private minifyScript(script: string): string {
    // 简单的压缩：移除注释和多余空格
    return script
      .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除 /* */ 注释
      .replace(/\/\/.*$/gm, '')          // 移除 // 注释
      .replace(/\n\s*/g, ' ')            // 移除换行和缩进
      .replace(/\s+/g, ' ')              // 合并多个空格
      .trim();
  }
}
```

---

## 🧪 测试

### 单元测试

```typescript
// bookmarklet.service.spec.ts
import { Test } from '@nestjs/testing';
import { BookmarkletService } from './bookmarklet.service';

describe('BookmarkletService', () => {
  let service: BookmarkletService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BookmarkletService],
    }).compile();

    service = module.get<BookmarkletService>(BookmarkletService);
  });

  describe('getCWSExtractorScript', () => {
    it('should return minified JavaScript', async () => {
      const script = await service.getCWSExtractorScript();
      
      expect(script).toContain('function');
      expect(script).not.toContain('//');  // 不应有注释
      expect(script).not.toContain('/*');
    });
  });
});
```

### 手动测试

1. 启动后端服务
2. 访问 `http://localhost:3001/api/bookmarklet/cws-extractor.js`
3. 确认返回 JavaScript 代码
4. 在 Chrome Web Store 页面测试 Bookmarklet

---

## 📦 部署

### 环境变量

```bash
# .env
# Bookmarklet 配置
BOOKMARKLET_CDN_URL=https://cdn.yourdomain.com/bookmarklet
BOOKMARKLET_CACHE_TTL=3600
```

### 静态文件 CDN（可选）

生产环境建议用 CDN 分发脚本：

```typescript
// 修改 controller，支持 CDN 跳转
@Get('cws-extractor.js')
async getCWSExtractor(@Res() res: Response) {
  const cdnUrl = this.configService.get('BOOKMARKLET_CDN_URL');
  if (cdnUrl) {
    return res.redirect(`${cdnUrl}/cws-extractor.min.js`);
  }
  // 否则直接返回
  const script = await this.service.getCWSExtractorScript();
  res.send(script);
}
```

---

## 🔄 更新流程

当 CWS 页面改版时：

1. 更新 `templates/cws-extractor.js` 中的选择器
2. 重新部署后端
3. Bookmarklet 自动获取最新脚本（无需用户重新安装）

---

## 📝 下一步

- [ ] 实现 App Store 提取脚本
- [ ] 实现 Google Play 提取脚本
- [ ] 添加更多错误处理
- [ ] 支持提取图片/视频
