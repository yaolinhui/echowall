# EchoWall Widget v2.0

> 生产级第三方 Widget 嵌入方案

## ✨ 核心特性

- **完全隔离** - Shadow DOM + iframe 双重隔离，样式和脚本完全独立
- **极小体积** - Loader 仅 ~2KB (gzipped)，异步加载不阻塞页面
- **智能懒加载** - Intersection Observer 实现视口内加载，交互提前触发
- **自动降级** - 根据浏览器支持自动选择最优隔离方案
- **安全通信** - postMessage + 来源验证，支持心跳检测和重连
- **高性能** - 虚拟滚动、防抖节流、资源预加载
- **无障碍** - ARIA 标签、键盘导航、减少动画偏好支持
- **SEO 友好** - 服务端渲染支持、结构化数据

## 🚀 快速开始

### 方式一：自动初始化（推荐）

```html
<!-- 添加容器 -->
<div 
  id="my-widget"
  data-echowall="YOUR_PROJECT_ID"
  data-theme="light"
  data-layout="carousel"
  data-max-items="10"
  data-lazy-load="true"
></div>

<!-- 引入脚本 -->
<script src="https://cdn.echowall.io/embed.js" async></script>
```

### 方式二：手动初始化

```html
<div id="my-widget"></div>

<script src="https://cdn.echowall.io/embed.js"></script>
<script>
  const widget = EchoWall.init('my-widget', 'YOUR_PROJECT_ID', {
    theme: 'dark',
    layout: 'grid',
    maxItems: 6,
    lazyLoad: false,
    isolation: 'hybrid'  // 'shadow' | 'iframe' | 'hybrid'
  });
</script>
```

## 📦 隔离方案选择

| 方案 | 样式隔离 | JS 隔离 | 性能 | 适用场景 |
|------|---------|--------|------|---------|
| `shadow` | ✅ | ❌ | ⭐⭐⭐ | 可信环境、高性能需求 |
| `iframe` | ✅ | ✅ | ⭐⭐ | 高安全要求、跨域需求 |
| `hybrid` | ✅ | ✅ | ⭐⭐⭐ | **默认推荐**，平衡安全与性能 |

```javascript
// 根据场景选择隔离级别
EchoWall.init('widget', 'PROJECT_ID', {
  // 隔离模式
  isolation: 'hybrid',  // 默认
  
  // Shadow DOM 模式: 'open' 或 'closed'
  shadowMode: 'closed',
  
  // iframe sandbox 权限
  allowForms: true,
  allowPopups: true
});
```

## ⚡ 性能优化

### 懒加载策略

```javascript
// 1. 视口内加载（默认）
EchoWall.init('widget', 'PROJECT_ID', {
  lazyLoad: true,  // 进入视口时加载
  lazyLoadMargin: '100px'  // 提前 100px 开始加载
});

// 2. 交互触发加载
// 鼠标悬停或点击时提前加载，无需配置

// 3. 手动控制
const widget = new EchoWall.Widget('widget', 'PROJECT_ID', {
  lazyLoad: false
});
// 在需要时调用
widget.init();
```

### 资源预加载

```html
<!-- 在 <head> 中添加 -->
<link rel="preconnect" href="https://cdn.echowall.io">
<link rel="dns-prefetch" href="https://api.echowall.io">
<link rel="preload" href="https://cdn.echowall.io/embed.js" as="script">
```

## 🔒 安全特性

### XSS 防护
- 所有动态内容自动转义
- 支持 DOMPurify 集成
- CSP 兼容设计

### 通信安全
```javascript
// 只接受来自指定来源的消息
EchoWall.init('widget', 'PROJECT_ID', {
  allowedOrigins: ['https://widget.echowall.io']
});

// 验证消息来源
// 自动过滤非目标窗口的消息
```

### iframe Sandbox
```javascript
EchoWall.init('widget', 'PROJECT_ID', {
  isolation: 'iframe',
  // 最小权限原则
  allowScripts: true,     // 必需
  allowSameOrigin: true,  // 必需
  allowForms: false,      // 默认禁用
  allowPopups: true       // 允许弹窗
});
```

## 🎨 主题定制

### 内置主题
```javascript
// Light 主题（默认）
data-theme="light"

// Dark 主题
data-theme="dark"
```

### CSS 变量覆盖
```css
/* 在宿主页面定义变量 */
echowall-widget {
  --ew-primary: #your-brand-color;
  --ew-radius: 8px;
}
```

## 📡 事件系统

```javascript
// 监听 Widget 事件
const container = document.getElementById('my-widget');

container.addEventListener('echowall:load', (e) => {
  console.log('Widget loaded', e.detail);
});

container.addEventListener('echowall:error', (e) => {
  console.error('Widget error', e.detail);
});

container.addEventListener('echowall:resize', (e) => {
  console.log('Widget resized', e.detail.height);
});
```

## 🛠️ API 参考

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `theme` | string | 'light' | 主题: 'light' \| 'dark' |
| `layout` | string | 'carousel' | 布局: 'carousel' \| 'grid' \| 'list' |
| `isolation` | string | 'hybrid' | 隔离: 'shadow' \| 'iframe' \| 'hybrid' |
| `lazyLoad` | boolean | true | 懒加载 |
| `maxItems` | number | 10 | 最大显示数 |
| `autoPlay` | boolean | true | 自动轮播 |
| `autoPlayInterval` | number | 5000 | 轮播间隔(ms) |

### 实例方法

```javascript
const widget = EchoWall.init('widget', 'PROJECT_ID', options);

// 刷新数据
widget.refresh();

// 销毁实例
widget.destroy();

// 切换幻灯片（轮播模式）
widget.next();
widget.prev();
widget.goTo(index);
```

### 全局配置

```javascript
// 修改全局配置
EchoWall.configure({
  cdnUrl: 'https://your-cdn.com',
  apiUrl: 'https://your-api.com',
  timeout: 30000,
  retryAttempts: 3
});

// 设置日志级别
EchoWall.Logger.level = 'debug';  // 'debug' | 'info' | 'warn' | 'error'
```

## 📁 文件结构

```
widget/
├── src/
│   ├── embed.js          # 嵌入脚本（Loader）
│   ├── core/
│   │   ├── widget-core.js    # 核心渲染引擎
│   │   └── communicator.js   # 通信模块
│   └── styles/
│       └── core.css          # 核心样式
├── dist/                 # 构建输出
├── demo.html            # 演示页面
└── README.md
```

## 🌐 浏览器支持

| 浏览器 | 版本 |
|--------|------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |
| IE | ❌ 不支持 |

## 📄 许可证

MIT © EchoWall
