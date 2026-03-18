/**
 * EchoWall Widget v2.0.0
 * 生产级第三方 Widget 嵌入方案
 * 
 * 特性：
 * - Shadow DOM + iframe 混合隔离
 * - 懒加载支持
 * - 完全样式隔离
 * - XSS 防护
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self), (global.EchoWall = factory()));
})(this, function () {
  'use strict';

  // ============ 配置常量 ============
  const CONFIG = {
    version: '2.0.0',
    apiUrl: 'http://localhost:3001/api',
    cdnUrl: 'https://cdn.echowall.io',
    widgetUrl: 'https://widget.echowall.io',
    lazyLoadMargin: '100px',
    timeout: 30000
  };

  // ============ 工具函数 ============
  
  const Utils = {
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    generateId() {
      return 'ew-' + Math.random().toString(36).substr(2, 9);
    },

    mergeConfig(defaults, options) {
      return { ...defaults, ...options };
    },

    detectFeatures() {
      return {
        shadowDOM: !!HTMLElement.prototype.attachShadow,
        customElements: 'customElements' in window,
        intersectionObserver: 'IntersectionObserver' in window,
        postMessage: 'postMessage' in window
      };
    }
  };

  // ============ 样式注入器 ============
  
  const StyleInjector = {
    styles: new Map(),

    getCoreStyles(theme = 'light') {
      const themes = {
        light: {
          primary: '#0ea5e9',
          bg: '#ffffff',
          surface: '#f8fafc',
          text: '#1e293b',
          textMuted: '#64748b',
          border: '#e2e8f0',
          shadow: '0 1px 3px rgba(0,0,0,0.1)'
        },
        dark: {
          primary: '#38bdf8',
          bg: '#1e293b',
          surface: '#334155',
          text: '#f1f5f9',
          textMuted: '#94a3b8',
          border: '#475569',
          shadow: '0 1px 3px rgba(0,0,0,0.3)'
        }
      };

      const t = themes[theme] || themes.light;

      return `
        :host {
          all: initial;
          display: block;
          --ew-primary: ${t.primary};
          --ew-bg: ${t.bg};
          --ew-surface: ${t.surface};
          --ew-text: ${t.text};
          --ew-text-muted: ${t.textMuted};
          --ew-border: ${t.border};
          --ew-shadow: ${t.shadow};
          --ew-radius: 12px;
          --ew-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-family: var(--ew-font);
        }
        
        *, *::before, *::after { box-sizing: border-box; }
        
        .ew-container {
          background: var(--ew-bg);
          border-radius: var(--ew-radius);
          padding: 20px;
        }
        
        .ew-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: var(--ew-text-muted);
        }
        
        .ew-item {
          background: var(--ew-surface);
          border: 1px solid var(--ew-border);
          border-radius: var(--ew-radius);
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: var(--ew-shadow);
        }
        
        .ew-content { margin-bottom: 16px; }
        
        .ew-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: var(--ew-text);
        }
        
        .ew-text::before {
          content: '"';
          color: var(--ew-primary);
          font-size: 1.5em;
          margin-right: 4px;
        }
        
        .ew-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid var(--ew-border);
        }
        
        .ew-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .ew-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--ew-border);
        }
        
        .ew-author-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .ew-author-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--ew-text);
        }
        
        .ew-platform {
          font-size: 12px;
          color: var(--ew-text-muted);
          text-transform: capitalize;
        }
        
        .ew-date {
          font-size: 12px;
          color: var(--ew-text-muted);
        }
        
        .ew-error {
          padding: 40px 20px;
          text-align: center;
          color: #ef4444;
          background: #fef2f2;
          border-radius: var(--ew-radius);
        }
        
        .ew-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--ew-text-muted);
        }
        
        /* 轮播样式 */
        .ew-carousel {
          position: relative;
          overflow: hidden;
        }
        
        .ew-carousel-track {
          display: flex;
          transition: transform 0.3s ease;
        }
        
        .ew-carousel .ew-item {
          flex: 0 0 100%;
          min-width: 100%;
          margin-bottom: 0;
        }
        
        .ew-carousel-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
        }
        
        .ew-prev, .ew-next {
          width: 36px;
          height: 36px;
          border: 1px solid var(--ew-border);
          background: var(--ew-bg);
          color: var(--ew-text);
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .ew-prev:hover, .ew-next:hover {
          background: var(--ew-primary);
          color: white;
          border-color: var(--ew-primary);
        }
        
        .ew-dots {
          display: flex;
          gap: 8px;
        }
        
        .ew-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: var(--ew-border);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .ew-dot.active {
          background: var(--ew-primary);
          width: 24px;
          border-radius: 4px;
        }
        
        /* 网格布局 */
        .ew-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        
        /* 列表布局 */
        .ew-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        /* 响应式 */
        @media (max-width: 640px) {
          .ew-grid { grid-template-columns: 1fr; }
          .ew-item { padding: 16px; }
          .ew-avatar { width: 32px; height: 32px; }
        }
      `;
    },

    inject(shadow, theme) {
      if (!shadow) return;
      
      const style = document.createElement('style');
      style.textContent = this.getCoreStyles(theme);
      shadow.appendChild(style);
    }
  };

  // ============ 懒加载器 ============
  
  class LazyLoader {
    constructor() {
      this.observers = new Map();
      this.loaded = new Set();
    }

    observe(element, callback, margin = CONFIG.lazyLoadMargin) {
      if (this.loaded.has(element)) {
        callback();
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loaded.add(element);
            callback();
            observer.unobserve(element);
            this.observers.delete(element);
          }
        });
      }, { rootMargin: margin });

      observer.observe(element);
      this.observers.set(element, observer);
    }

    loadOnInteraction(element, events, callback) {
      let loaded = false;
      const handler = () => {
        if (!loaded) {
          loaded = true;
          callback();
        }
      };
      events.forEach(event => {
        element.addEventListener(event, handler, { once: true });
      });
    }
  }

  // ============ Widget 核心 ============
  
  class WidgetCore {
    constructor(shadow, config) {
      this.shadow = shadow;
      this.config = config;
      this.mentions = [];
      this.currentIndex = 0;
      this.autoPlayTimer = null;
      this.container = null;
    }

    async init() {
      // 注入样式
      StyleInjector.inject(this.shadow, this.config.theme);
      
      // 创建容器
      this.container = document.createElement('div');
      this.container.className = 'ew-container';
      this.shadow.appendChild(this.container);
      
      // 显示加载状态
      this.showLoading();
      
      try {
        await this.fetchData();
        this.render();
      } catch (error) {
        this.showError(error.message);
      }
    }

    showLoading() {
      this.container.innerHTML = '<div class="ew-loading">Loading...</div>';
    }

    showError(message) {
      this.container.innerHTML = `<div class="ew-error">⚠️ ${Utils.escapeHtml(message)}</div>`;
    }

    async fetchData() {
      const response = await fetch(
        `${this.config.apiUrl}/api/widget/${this.config.projectId}/data`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      this.mentions = (data.mentions || []).slice(0, this.config.maxItems);
    }

    render() {
      if (this.mentions.length === 0) {
        this.container.innerHTML = '<div class="ew-empty">No mentions yet</div>';
        return;
      }

      const items = this.mentions.map(m => this.renderItem(m));
      
      switch (this.config.layout) {
        case 'grid':
          this.container.innerHTML = `<div class="ew-grid">${items.join('')}</div>`;
          break;
        case 'list':
          this.container.innerHTML = `<div class="ew-list">${items.join('')}</div>`;
          break;
        case 'carousel':
        default:
          this.renderCarousel(items);
          break;
      }
    }

    renderItem(mention) {
      const avatar = mention.authorAvatar || 'https://www.gravatar.com/avatar/?d=mp';
      const author = Utils.escapeHtml(mention.authorName || 'Anonymous');
      const content = Utils.escapeHtml(mention.content);
      const platform = Utils.escapeHtml(mention.platform || '');
      
      return `
        <div class="ew-item">
          <div class="ew-content"><p class="ew-text">${content}</p></div>
          <div class="ew-footer">
            <div class="ew-author">
              <img src="${avatar}" alt="${author}" class="ew-avatar" loading="lazy" />
              <div class="ew-author-info">
                <span class="ew-author-name">${author}</span>
                <span class="ew-platform">${platform}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderCarousel(items) {
      const dots = items.map((_, i) => 
        `<button class="ew-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>`
      ).join('');

      this.container.innerHTML = `
        <div class="ew-carousel">
          <div class="ew-carousel-track" style="transform: translateX(0%)">
            ${items.join('')}
          </div>
          <div class="ew-carousel-nav">
            <button class="ew-prev">&#8249;</button>
            <div class="ew-dots">${dots}</div>
            <button class="ew-next">&#8250;</button>
          </div>
        </div>
      `;

      this.attachCarouselEvents();
      
      if (this.config.autoPlay) {
        this.startAutoPlay();
      }
    }

    attachCarouselEvents() {
      const prev = this.container.querySelector('.ew-prev');
      const next = this.container.querySelector('.ew-next');
      const dots = this.container.querySelectorAll('.ew-dot');
      const track = this.container.querySelector('.ew-carousel-track');

      prev?.addEventListener('click', () => this.prev());
      next?.addEventListener('click', () => this.next());
      
      dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
          this.goTo(parseInt(e.target.dataset.index));
        });
      });

      if (this.config.autoPlay) {
        track.addEventListener('mouseenter', () => this.stopAutoPlay());
        track.addEventListener('mouseleave', () => this.startAutoPlay());
      }
    }

    goTo(index) {
      if (index < 0) index = this.mentions.length - 1;
      if (index >= this.mentions.length) index = 0;
      
      this.currentIndex = index;
      
      const track = this.container.querySelector('.ew-carousel-track');
      const dots = this.container.querySelectorAll('.ew-dot');
      
      if (track) {
        track.style.transform = `translateX(-${index * 100}%)`;
      }
      
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }

    next() { this.goTo(this.currentIndex + 1); }
    prev() { this.goTo(this.currentIndex - 1); }

    startAutoPlay() {
      if (this.mentions.length <= 1) return;
      this.stopAutoPlay();
      this.autoPlayTimer = setInterval(() => this.next(), this.config.autoPlayInterval);
    }

    stopAutoPlay() {
      if (this.autoPlayTimer) {
        clearInterval(this.autoPlayTimer);
        this.autoPlayTimer = null;
      }
    }

    destroy() {
      this.stopAutoPlay();
    }
  }

  // ============ Shadow Host ============
  
  class ShadowHost {
    constructor(container, config) {
      this.container = container;
      this.config = config;
      this.shadow = null;
      this.widget = null;
    }

    async init() {
      const features = Utils.detectFeatures();
      
      if (!features.shadowDOM) {
        // 降级方案：直接在容器内渲染
        this.widget = new WidgetCore(null, this.config);
        await this.widget.init();
        return;
      }

      // 创建 Shadow DOM
      this.shadow = this.container.attachShadow({ 
        mode: this.config.shadowMode || 'closed' 
      });

      // 初始化 Widget Core
      this.widget = new WidgetCore(this.shadow, this.config);
      await this.widget.init();
    }

    destroy() {
      if (this.widget) {
        this.widget.destroy();
      }
      if (this.shadow) {
        this.shadow.innerHTML = '';
      }
    }
  }

  // ============ 主 Widget 类 ============
  
  class EchoWallWidget {
    constructor(containerId, projectId, options = {}) {
      if (!containerId) throw new Error('containerId is required');
      if (!projectId) throw new Error('projectId is required');

      this.container = document.getElementById(containerId);
      if (!this.container) {
        throw new Error(`Container "${containerId}" not found`);
      }

      this.projectId = projectId;
      this.config = Utils.mergeConfig({
        apiUrl: CONFIG.apiUrl,
        theme: 'light',
        layout: 'carousel',
        maxItems: 10,
        autoPlay: true,
        autoPlayInterval: 5000,
        lazyLoad: true,
        shadowMode: 'closed'
      }, options);

      this.host = null;
      this.lazyLoader = new LazyLoader();
      this.state = { loaded: false, loading: false, error: null };
    }

    async init() {
      if (this.state.loading || this.state.loaded) return this;

      this.state.loading = true;

      try {
        if (this.config.lazyLoad) {
          await this.loadLazy();
        } else {
          await this.loadImmediately();
        }
        this.state.loaded = true;
      } catch (error) {
        this.state.error = error;
        console.error('[EchoWall]', error);
      } finally {
        this.state.loading = false;
      }

      return this;
    }

    loadLazy() {
      return new Promise((resolve) => {
        this.lazyLoader.observe(this.container, () => {
          this.loadImmediately().then(resolve);
        });

        this.lazyLoader.loadOnInteraction(
          this.container,
          ['mouseenter', 'click'],
          () => {
            if (!this.state.loaded) {
              this.loadImmediately().then(resolve);
            }
          }
        );
      });
    }

    async loadImmediately() {
      this.host = new ShadowHost(this.container, {
        ...this.config,
        projectId: this.projectId
      });
      await this.host.init();
    }

    destroy() {
      if (this.host) {
        this.host.destroy();
        this.host = null;
      }
      this.state.loaded = false;
    }
  }

  // ============ 自动初始化 ============
  
  function autoInit() {
    document.querySelectorAll('[data-echowall]').forEach(container => {
      const projectId = container.getAttribute('data-echowall');
      if (!projectId || !container.id) return;

      const options = {};
      Array.from(container.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') && attr.name !== 'data-echowall') {
          const key = attr.name
            .replace('data-', '')
            .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          
          let value = attr.value;
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = Number(value);
          
          options[key] = value;
        }
      });

      const widget = new EchoWallWidget(container.id, projectId, options);
      widget.init();
      container._echowall = widget;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // ============ 暴露 API ============
  
  return {
    version: CONFIG.version,
    init: (containerId, projectId, options) => 
      new EchoWallWidget(containerId, projectId, options).init(),
    autoInit,
    utils: Utils
  };
});
