/**
 * EchoWall Widget Embed Script v2.0.0
 * 生产级第三方 Widget 嵌入方案
 * 
 * 特性：
 * - 极小体积（~2KB gzipped）
 * - 异步加载，不阻塞页面渲染
 * - 自动检测 Shadow DOM 和 iframe 支持
 * - 懒加载支持（Intersection Observer）
 * - 降级策略（无 Shadow DOM 时使用 iframe）
 */

(function(global, factory) {
  'use strict';
  
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.EchoWall = factory();
  }
})(this, function() {
  'use strict';

  // ============ 配置常量 ============
  const CONFIG = {
    version: '2.0.0',
    cdnUrl: 'https://cdn.echowall.io',
    apiUrl: 'https://api.echowall.io',
    widgetUrl: 'https://widget.echowall.io',
    lazyLoadMargin: '100px',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  // ============ 工具函数 ============
  
  function safeJSONParse(str, defaultValue) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return defaultValue || {};
    }
  }

  function generateId() {
    return 'ew-' + Math.random().toString(36).substr(2, 9);
  }

  function mergeConfig(defaults, options) {
    const result = {};
    for (const key in defaults) {
      result[key] = defaults[key];
    }
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        result[key] = options[key];
      }
    }
    return result;
  }

  function detectFeatures() {
    return {
      shadowDOM: !!HTMLElement.prototype.attachShadow,
      customElements: 'customElements' in window,
      intersectionObserver: 'IntersectionObserver' in window,
      mutationObserver: 'MutationObserver' in window,
      postMessage: 'postMessage' in window,
      proxy: 'Proxy' in window
    };
  }

  function withTimeout(promise, ms, errorMessage) {
    const timeout = new Promise(function(_, reject) {
      setTimeout(function() {
        reject(new Error(errorMessage || 'Timeout'));
      }, ms);
    });
    return Promise.race([promise, timeout]);
  }

  function withRetry(fn, attempts, delay) {
    attempts = attempts || CONFIG.retryAttempts;
    delay = delay || CONFIG.retryDelay;
    
    return new Promise(function(resolve, reject) {
      var tryFn = function(attempt) {
        fn().then(resolve).catch(function(error) {
          if (attempt >= attempts - 1) {
            reject(error);
          } else {
            setTimeout(function() {
              tryFn(attempt + 1);
            }, delay * Math.pow(2, attempt));
          }
        });
      };
      tryFn(0);
    });
  }

  // ============ 日志管理 ============
  
  var Logger = {
    level: 'warn',
    levels: { debug: 0, info: 1, warn: 2, error: 3 },
    
    log: function(level, message) {
      if (this.levels[level] >= this.levels[this.level]) {
        var args = Array.prototype.slice.call(arguments, 2);
        console[level]('[EchoWall ' + level.toUpperCase() + ']', message, args);
      }
    },
    
    debug: function(msg) { this.log.apply(this, ['debug'].concat(Array.prototype.slice.call(arguments))); },
    info: function(msg) { this.log.apply(this, ['info'].concat(Array.prototype.slice.call(arguments))); },
    warn: function(msg) { this.log.apply(this, ['warn'].concat(Array.prototype.slice.call(arguments))); },
    error: function(msg) { this.log.apply(this, ['error'].concat(Array.prototype.slice.call(arguments))); }
  };

  // ============ Shadow Host 管理 ============
  
  function ShadowHost(container, config) {
    this.container = container;
    this.config = config;
    this.shadow = null;
    this.iframe = null;
    this.messageHandler = null;
  }

  ShadowHost.prototype.init = function() {
    var features = detectFeatures();
    
    if (this.config.isolation === 'iframe' || !features.shadowDOM) {
      return this.initIframeMode();
    } else if (this.config.isolation === 'shadow') {
      return this.initShadowMode();
    } else {
      return this.initHybridMode();
    }
  };

  ShadowHost.prototype.initShadowMode = function() {
    Logger.debug('Initializing Shadow DOM mode');
    
    var mode = this.config.shadowMode || 'closed';
    this.shadow = this.container.attachShadow({ mode: mode });
    
    var style = document.createElement('style');
    style.textContent = this.getShadowStyles();
    this.shadow.appendChild(style);
    
    var content = document.createElement('div');
    content.className = 'ew-widget-root';
    content.innerHTML = '<div class="ew-loading">Loading...</div>';
    this.shadow.appendChild(content);
    
    this.loadCoreScript();
    
    return { mode: 'shadow', shadow: this.shadow };
  };

  ShadowHost.prototype.initIframeMode = function() {
    Logger.debug('Initializing iframe mode');
    
    this.iframe = document.createElement('iframe');
    
    var sandbox = [
      'allow-scripts',
      'allow-same-origin',
      'allow-popups',
      'allow-popups-to-escape-sandbox'
    ];
    
    if (this.config.allowForms !== false) {
      sandbox.push('allow-forms');
    }
    
    this.iframe.sandbox = sandbox.join(' ');
    this.iframe.style.cssText = 'width: 100%; height: ' + (this.config.height || '400px') + '; border: none; overflow: hidden;';
    
    var params = new URLSearchParams({
      projectId: this.config.projectId,
      theme: this.config.theme || 'light',
      layout: this.config.layout || 'carousel',
      origin: window.location.origin
    });
    
    this.iframe.src = CONFIG.widgetUrl + '/embed?' + params.toString();
    this.container.appendChild(this.iframe);
    
    this.setupMessageChannel();
    
    return { mode: 'iframe', iframe: this.iframe };
  };

  ShadowHost.prototype.initHybridMode = function() {
    Logger.debug('Initializing hybrid mode (Shadow DOM + iframe)');
    
    var mode = this.config.shadowMode || 'closed';
    this.shadow = this.container.attachShadow({ mode: mode });
    
    var style = document.createElement('style');
    style.textContent = ':host { display: block; } .ew-widget-container { position: relative; width: 100%; min-height: ' + (this.config.minHeight || '200px') + '; } iframe { width: 100%; border: none; display: block; }';
    this.shadow.appendChild(style);
    
    var wrapper = document.createElement('div');
    wrapper.className = 'ew-widget-container';
    this.shadow.appendChild(wrapper);
    
    this.iframe = document.createElement('iframe');
    this.iframe.sandbox = 'allow-scripts allow-same-origin allow-popups';
    this.iframe.style.height = this.config.height || '400px';
    
    var params = new URLSearchParams({
      projectId: this.config.projectId,
      theme: this.config.theme || 'light',
      layout: this.config.layout || 'carousel',
      origin: window.location.origin,
      v: CONFIG.version
    });
    
    this.iframe.src = CONFIG.widgetUrl + '/embed?' + params.toString();
    wrapper.appendChild(this.iframe);
    
    this.setupMessageChannel();
    
    return { mode: 'hybrid', shadow: this.shadow, iframe: this.iframe };
  };

  ShadowHost.prototype.setupMessageChannel = function() {
    var self = this;
    
    this.messageHandler = function(event) {
      if (event.source !== self.iframe.contentWindow) {
        return;
      }
      
      var widgetOrigin = new URL(CONFIG.widgetUrl).origin;
      if (event.origin !== widgetOrigin) {
        Logger.warn('Message from untrusted origin:', event.origin);
        return;
      }
      
      self.handleMessage(event.data);
    };
    
    window.addEventListener('message', this.messageHandler);
  };

  ShadowHost.prototype.handleMessage = function(data) {
    if (!data || typeof data !== 'object') return;
    
    switch (data.type) {
      case 'RESIZE':
        if (this.iframe && data.height) {
          this.iframe.style.height = data.height + 'px';
        }
        break;
        
      case 'READY':
        Logger.debug('Widget iframe ready');
        this.iframe.contentWindow.postMessage({
          type: 'INIT',
          config: this.config
        }, CONFIG.widgetUrl);
        break;
        
      case 'ERROR':
        Logger.error('Widget error:', data.error);
        break;
        
      case 'EVENT':
        this.dispatchHostEvent(data.eventName, data.eventData);
        break;
    }
  };

  ShadowHost.prototype.dispatchHostEvent = function(name, data) {
    var event = new CustomEvent('echowall:' + name, {
      detail: data,
      bubbles: true
    });
    this.container.dispatchEvent(event);
  };

  ShadowHost.prototype.loadCoreScript = function() {
    var script = document.createElement('script');
    script.src = CONFIG.cdnUrl + '/widget-core.js';
    script.async = true;
    script.onload = function() {
      if (window.EchoWallCore) {
        window.EchoWallCore.init(this.shadow, this.config);
      }
    }.bind(this);
    
    this.shadow.appendChild(script);
  };

  ShadowHost.prototype.getShadowStyles = function() {
    return ':host { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; } *, *::before, *::after { box-sizing: border-box; } .ew-widget-root { width: 100%; } .ew-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666; }';
  };

  ShadowHost.prototype.destroy = function() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    
    if (this.shadow) {
      this.shadow.innerHTML = '';
    }
    
    if (this.iframe) {
      this.iframe.remove();
    }
  };

  // ============ 懒加载管理 ============
  
  function LazyLoader() {
    this.observers = new Map();
    this.loadedWidgets = new Set();
  }

  LazyLoader.prototype.observe = function(element, callback, options) {
    if (this.loadedWidgets.has(element)) {
      callback();
      return;
    }

    options = options || {};
    var margin = options.margin || CONFIG.lazyLoadMargin;
    var self = this;
    
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          self.loadedWidgets.add(element);
          callback();
          observer.unobserve(element);
          self.observers.delete(element);
        }
      });
    }, {
      rootMargin: margin,
      threshold: options.threshold || 0
    });

    observer.observe(element);
    this.observers.set(element, observer);
  };

  LazyLoader.prototype.loadOnInteraction = function(element, events, callback) {
    events = events || ['mouseenter', 'click'];
    var loaded = false;
    var self = this;
    
    var handler = function() {
      if (!loaded) {
        loaded = true;
        callback();
        events.forEach(function(event) {
          element.removeEventListener(event, handler);
        });
      }
    };
    
    events.forEach(function(event) {
      element.addEventListener(event, handler, { once: true });
    });
  };

  LazyLoader.prototype.cleanup = function() {
    this.observers.forEach(function(observer) { observer.disconnect(); });
    this.observers.clear();
  };

  // ============ 核心 Widget 类 ============
  
  function EchoWallWidget(containerId, projectId, options) {
    if (!containerId) {
      throw new Error('EchoWall: containerId is required');
    }
    if (!projectId) {
      throw new Error('EchoWall: projectId is required');
    }

    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error('EchoWall: Container with id "' + containerId + '" not found');
    }

    this.projectId = projectId;
    this.config = mergeConfig({
      theme: 'light',
      layout: 'carousel',
      maxItems: 10,
      autoPlay: true,
      autoPlayInterval: 5000,
      lazyLoad: true,
      isolation: 'hybrid',
      shadowMode: 'closed',
      height: 'auto',
      minHeight: '200px'
    }, options || {});

    this.host = null;
    this.lazyLoader = new LazyLoader();
    this.state = {
      loaded: false,
      loading: false,
      error: null
    };

    this.performanceMarks = {
      init: performance.now()
    };
  }

  EchoWallWidget.prototype.init = function() {
    if (this.state.loading || this.state.loaded) {
      return Promise.resolve(this);
    }

    this.state.loading = true;
    var self = this;
    
    return new Promise(function(resolve) {
      try {
        self.container.classList.add('ew-placeholder');

        if (self.config.lazyLoad) {
          self.loadLazy().then(function() {
            self.state.loaded = true;
            self.container.classList.remove('ew-placeholder');
            resolve(self);
          });
        } else {
          self.loadImmediately().then(function() {
            self.state.loaded = true;
            self.container.classList.remove('ew-placeholder');
            resolve(self);
          });
        }
      } catch (error) {
        self.state.error = error;
        Logger.error('Failed to initialize widget:', error);
        self.showError();
        self.state.loading = false;
        self.container.classList.remove('ew-placeholder');
        resolve(self);
      }
    });
  };

  EchoWallWidget.prototype.loadLazy = function() {
    var self = this;
    return new Promise(function(resolve) {
      self.lazyLoader.observe(self.container, function() {
        self.loadImmediately().then(resolve);
      });

      self.lazyLoader.loadOnInteraction(
        self.container,
        ['mouseenter', 'click', 'focus'],
        function() {
          if (!self.state.loaded) {
            self.loadImmediately().then(resolve);
          }
        }
      );
    });
  };

  EchoWallWidget.prototype.loadImmediately = function() {
    var self = this;
    
    this.host = new ShadowHost(this.container, mergeConfig(this.config, {
      projectId: this.projectId
    }));
    
    return Promise.resolve(this.host.init());
  };

  EchoWallWidget.prototype.showError = function() {
    this.container.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #ef4444; background: #fef2f2; border-radius: 8px; font-family: system-ui, sans-serif;"><div style="font-size: 24px; margin-bottom: 8px;">⚠️</div><div>Widget 加载失败</div><div style="font-size: 12px; color: #999; margin-top: 8px;">' + (this.state.error ? this.state.error.message : 'Unknown error') + '</div></div>';
  };

  EchoWallWidget.prototype.destroy = function() {
    if (this.host) {
      this.host.destroy();
      this.host = null;
    }
    
    this.lazyLoader.cleanup();
    this.state.loaded = false;
    this.container.innerHTML = '';
  };

  EchoWallWidget.prototype.refresh = function() {
    if (this.host) {
      this.host.destroy();
      this.host = null;
    }
    this.state.loaded = false;
    this.state.error = null;
    return this.init();
  };

  // ============ 自动初始化 ============
  
  function autoInit() {
    var containers = document.querySelectorAll('[data-echowall]');
    
    containers.forEach(function(container) {
      var projectId = container.getAttribute('data-echowall');
      if (!projectId) return;

      var options = {};
      var attributes = container.attributes;
      
      for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        if (attr.name.indexOf('data-') === 0 && attr.name !== 'data-echowall') {
          var key = attr.name
            .replace('data-', '')
            .replace(/-([a-z])/g, function(match, letter) { return letter.toUpperCase(); });
          
          var value = attr.value;
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = Number(value);
          
          options[key] = value;
        }
      }

      var widget = new EchoWallWidget(container.id, projectId, options);
      widget.init();
      container._echowall = widget;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // 暴露 API
  return {
    version: CONFIG.version,
    init: function(containerId, projectId, options) {
      return new EchoWallWidget(containerId, projectId, options).init();
    },
    autoInit: autoInit,
    configure: function(options) {
      for (var key in options) {
        if (options.hasOwnProperty(key)) {
          CONFIG[key] = options[key];
        }
      }
    },
    Logger: Logger,
    utils: {
      safeJSONParse: safeJSONParse,
      generateId: generateId,
      mergeConfig: mergeConfig,
      detectFeatures: detectFeatures,
      withTimeout: withTimeout,
      withRetry: withRetry
    }
  };
});
