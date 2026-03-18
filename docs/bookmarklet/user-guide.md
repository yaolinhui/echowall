# Bookmarklet 用户使用指南

## 📖 什么是 Bookmarklet？

**Bookmarklet** 是一个保存在浏览器书签栏的 JavaScript 代码片段。

点击它时，代码会在**当前网页**上执行，实现特定功能。

**优点**：
- ✅ 无需安装扩展（不用等 Chrome 商店审核）
- ✅ 即装即用（2 秒完成）
- ✅ 完全免费
- ✅ 数据在自己的浏览器里处理

---

## 🚀 安装步骤（2 分钟）

### 步骤 1: 创建书签

1. 在浏览器任意页面，按 `Ctrl+D`（Mac: `Cmd+D`）创建书签
2. 名称填写：`提取 CWS 评价`
3. **关键步骤**：网址栏粘贴下面的代码

```javascript
javascript:(function(){const script=document.createElement('script');script.src='http://localhost:3001/api/bookmarklet/cws-extractor.js';document.head.appendChild(script);})();
```

4. 点击【保存】

### 步骤 2: 使用

1. 打开你的 Chrome Web Store 扩展页面
   - 例如：`https://chromewebstore.google.com/detail/onetab/chphlpgkkbolifaimnlloiipkdnihall`

2. 滚动到页面下方的 **Reviews** 区域

3. 点击书签栏的【提取 CWS 评价】按钮

4. 等待自动滚动加载所有评论（约 10-30 秒）

5. 完成后自动下载 `onetab-reviews-20240318.json` 文件

---

## 📋 提取的数据格式

下载的 JSON 文件包含以下字段：

```json
{
  "platform": "chromewebstore",
  "extensionId": "chphlpgkkbolifaimnlloiipkdnihall",
  "extensionName": "OneTab",
  "extractedAt": "2024-03-18T10:30:00.000Z",
  "totalReviews": 47,
  "reviews": [
    {
      "id": "review_001",
      "author": "Chrome User",
      "avatar": "https://...",
      "rating": 5,
      "content": "Very useful extension! Saves me so much memory...",
      "date": "2024-03-15",
      "helpful": 12,
      "sourceUrl": "https://chromewebstore.google.com/detail/onetab/..."
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `platform` | 平台标识 |
| `extensionId` | 扩展 ID |
| `extensionName` | 扩展名称 |
| `totalReviews` | 提取的总数量 |
| `reviews` | 评价数组 |
| `reviews[i].id` | 唯一标识 |
| `reviews[i].author` | 评论者名称 |
| `reviews[i].rating` | 评分 1-5 |
| `reviews[i].content` | 评论内容 |
| `reviews[i].date` | 评论日期 |

---

## 📤 导入到 EchoWall

### 步骤 1: 打开 EchoWall 后台

访问 `http://localhost:5173`（本地部署）

### 步骤 2: 进入导入页面

1. 选择你的项目
2. 点击左侧菜单【Mentions】
3. 点击右上角【导入评价】按钮

### 步骤 3: 上传文件

1. 选择平台：`Chrome Web Store`
2. 点击【选择文件】，选择刚才下载的 JSON
3. 点击【开始导入】

### 步骤 4: 查看结果

- 成功导入：显示导入数量和去重数量
- 失败：显示错误原因（如格式不正确）

---

## 🎯 各平台使用说明

### Chrome Web Store

**适用页面**：
```
https://chromewebstore.google.com/detail/{扩展名}/{扩展ID}
```

**提取内容**：
- ✅ 评论内容
- ✅ 评分（1-5 星）
- ✅ 评论者名称
- ✅ 评论日期
- ✅ 有用数（helpful count）

**限制**：
- 只能提取公开显示的评论
- 部分评论可能需要滚动加载

---

### App Store (iOS)

**Bookmarklet 代码**：
```javascript
javascript:(function(){const s=document.createElement('script');s.src='http://localhost:3001/api/bookmarklet/appstore-extractor.js';document.head.appendChild(s);})();
```

**适用页面**：
```
https://apps.apple.com/{国家}/app/{应用名}/id{应用ID}
```

**注意**：
- 需要美区 Apple ID 才能查看完整评论
- 页面使用动态加载，需要等待

---

### Google Play

**Bookmarklet 代码**：
```javascript
javascript:(function(){const s=document.createElement('script');s.src='http://localhost:3001/api/bookmarklet/playstore-extractor.js';document.head.appendChild(s);})();
```

**适用页面**：
```
https://play.google.com/store/apps/details?id={包名}
```

---

## ❓ 常见问题

### Q1: 提取的评论数量不对？

**原因**：Chrome Web Store 默认只显示前 10 条，需要滚动加载更多。

**解决**：Bookmarklet 会自动滚动页面，请耐心等待（大型扩展可能需要 30 秒）。

---

### Q2: 提示"无法提取数据"？

**可能原因**：
1. 不在正确的页面（必须在 CWS/App Store/Play Store 详情页）
2. 页面结构改版（Bookmarklet 需要更新）
3. 网络问题

**解决**：
1. 确认 URL 格式正确
2. 刷新页面后重试
3. 检查浏览器控制台错误（F12 → Console）

---

### Q3: 中文评论显示乱码？

**解决**：确保 JSON 文件以 UTF-8 编码保存（默认就是）。

---

### Q4: 可以提取竞争对手的评论吗？

**可以**。只要页面公开可见，就可以提取任何扩展/应用的评论。

**用途**：
- 竞品分析
- 了解用户痛点
- 发现市场机会

---

### Q5: 数据安全吗？

**安全**：
- 所有处理在浏览器本地完成
- 不会发送到第三方服务器
- 只有你自己能看到数据

---

## 🛠️ 故障排除

### 问题：点击 Bookmarklet 没反应

**检查清单**：
- [ ] 是否在正确的页面（CWS/App Store/Play Store）
- [ ] EchoWall 后端是否已启动（`http://localhost:3001` 可访问）
- [ ] 浏览器是否阻止了弹出窗口
- [ ] 检查浏览器控制台错误信息

### 问题：导入 EchoWall 失败

**检查清单**：
- [ ] JSON 文件格式是否正确（可用 [JSONLint](https://jsonlint.com/) 验证）
- [ ] 文件大小是否超过限制（默认 10MB）
- [ ] 是否选择了正确的平台

---

## 📞 获取帮助

如果遇到问题：
1. 查看浏览器控制台错误（F12 → Console）
2. 检查 [GitHub Issues](https://github.com/yaolinhui/echowall/issues)
3. 提交新问题，附上错误截图

---

## 🎉 下一步

提取成功后，去 [Mentions 页面筛选好评](../frontend/mentions-guide.md)！
