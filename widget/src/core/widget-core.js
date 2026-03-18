/**
 * EchoWall Widget Core v2.0.0
 * 核心渲染引擎
 */

(function(global, factory) {
  'use strict';
  
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.EchoWallCore = factory();
  }
})(this, function() {
  'use strict';

  // ============ 模板引擎 ============
  
  var Templates = {
    mention: function(data) {
      var avatar = data.authorAvatar || 'https://www.gravatar.com/avatar/?d=mp';
      var author = this.escapeHtml(data.authorName || 'Anonymous');
      var content = this.escapeHtml(data.content);
      var platform = this.escapeHtml(data.platform || '');
      var date = data.postedAt ? this.formatDate(data.postedAt) : '';
      
      return '<div class="ew-item" data-id="' + (data.id || '') + '">' +
        '<div class="ew-content"><p class="ew-text">' + content + '</p></div>' +
        '<div class="ew-footer">' +
          '<div class="ew-author">' +
            '<img src="' + avatar + '" alt="' + author + '" class="ew-avatar" loading="lazy" />' +
            '<div class="ew-author-info">' +
              '<span class="ew-author-name">' + author + '</span>' +
              '<span class="ew-platform">' + platform + '</span>' +
            '</div>' +
          '</div>' +
          (date ? '<span class="ew-date">' + date + '</span>' : '') +
        '</div>' +
      '</div>';
    },
    
    carousel: function(items) {
      var dots = items.map(function(_, i) {
        return '<button class="ew-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"></button>';
      }).join('');
      
      return '<div class="ew-carousel">' +
        '<div class="ew-carousel-track">' + items.join('') + '</div>' +
        '<div class="ew-carousel-nav">' +
          '<button class="ew-prev" aria-label="Previous">&#8249;</button>' +
          '<div class="ew-dots">' + dots + '</div>' +
          '<button class="ew-next" aria-label="Next">&#8250;</button>' +
        '</div>' +
      '</div>';
    },
    
    grid: function(items) {
      return '<div class="ew-grid">' + items.join('') + '</div>';
    },
    
    list: function(items) {
      return '<div class="ew-list">' + items.join('') + '</div>';
    },
    
    loading: function() {
      return '<div class="ew-loading"><div class="ew-spinner"></div><span>Loading...</span></div>';
    },
    
    error: function(message) {
      return '<div class="ew-error"><span class="ew-error-icon">&#9888;</span><p>' + this.escapeHtml(message) + '</p></div>';
    },
    
    empty: function() {
      return '<div class="ew-empty"><p>No mentions yet</p></div>';
    },
    
    escapeHtml: function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    formatDate: function(dateStr) {
      var date = new Date(dateStr);
      var now = new Date();
      var diff = now - date;
      
      // 小于 1 分钟
      if (diff < 60000) return 'Just now';
      // 小于 1 小时
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      // 小于 24 小时
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      // 小于 7 天
      if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
      
      return date.toLocaleDateString();
    }
  };

  // ============ 渲染引擎 ============
  
  function WidgetEngine(container, config) {
    this.container = container;
    this.config = config;
    this.mentions = [];
    this.currentIndex = 0;
    this.autoPlayTimer = null;
    this.isReady = false;
    
    this.init();
  }

  WidgetEngine.prototype.init = function() {
    this.bindMethods();
    this.renderLoading();
    this.fetchData();
  };

  WidgetEngine.prototype.bindMethods = function() {
    this.handlePrev = this.handlePrev.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleDotClick = this.handleDotClick.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleResize = this.debounce(this.handleResize.bind(this), 250);
  };

  WidgetEngine.prototype.debounce = function(fn, wait) {
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        fn.apply(context, args);
      }, wait);
    };
  };

  // ============ 数据获取 ============
  
  WidgetEngine.prototype.fetchData = function() {
    var self = this;
    var url = this.config.apiUrl + '/api/widget/' + this.config.projectId + '/data';
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Widget-Version': '2.0.0'
      }
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      self.mentions = (data.mentions || []).slice(0, self.config.maxItems || 10);
      self.isReady = true;
      self.render();
    })
    .catch(function(error) {
      self.renderError('Failed to load mentions: ' + error.message);
    });
  };

  // ============ 渲染方法 ============
  
  WidgetEngine.prototype.renderLoading = function() {
    this.container.innerHTML = Templates.loading();
  };

  WidgetEngine.prototype.renderError = function(message) {
    this.container.innerHTML = Templates.error(message);
  };

  WidgetEngine.prototype.render = function() {
    if (this.mentions.length === 0) {
      this.container.innerHTML = Templates.empty();
      return;
    }
    
    var items = this.mentions.map(function(mention) {
      return Templates.mention(mention);
    });
    
    var html = '';
    switch (this.config.layout) {
      case 'grid':
        html = Templates.grid(items);
        break;
      case 'list':
        html = Templates.list(items);
        break;
      case 'carousel':
      default:
        html = Templates.carousel(items);
        break;
    }
    
    this.container.innerHTML = html;
    this.attachEventListeners();
    this.applyTheme();
    
    if (this.config.layout === 'carousel' && this.config.autoPlay) {
      this.startAutoPlay();
    }
  };

  WidgetEngine.prototype.applyTheme = function() {
    this.container.classList.add('ew-theme-' + (this.config.theme || 'light'));
  };

  // ============ 事件处理 ============
  
  WidgetEngine.prototype.attachEventListeners = function() {
    if (this.config.layout !== 'carousel') return;
    
    var prevBtn = this.container.querySelector('.ew-prev');
    var nextBtn = this.container.querySelector('.ew-next');
    var dots = this.container.querySelectorAll('.ew-dot');
    var track = this.container.querySelector('.ew-carousel-track');
    
    if (prevBtn) prevBtn.addEventListener('click', this.handlePrev);
    if (nextBtn) nextBtn.addEventListener('click', this.handleNext);
    
    dots.forEach(function(dot) {
      dot.addEventListener('click', this.handleDotClick);
    }, this);
    
    // 自动播放控制
    if (this.config.autoPlay) {
      track.addEventListener('mouseenter', this.handleMouseEnter);
      track.addEventListener('mouseleave', this.handleMouseLeave);
    }
    
    // 响应式
    window.addEventListener('resize', this.handleResize);
    
    // 触摸滑动支持
    this.initTouchSupport();
  };

  WidgetEngine.prototype.initTouchSupport = function() {
    var track = this.container.querySelector('.ew-carousel-track');
    if (!track) return;
    
    var self = this;
    var startX = 0;
    var currentX = 0;
    var isDragging = false;
    
    track.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      isDragging = true;
    }, { passive: true });
    
    track.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });
    
    track.addEventListener('touchend', function() {
      if (!isDragging) return;
      isDragging = false;
      
      var diff = startX - currentX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          self.next();
        } else {
          self.prev();
        }
      }
    });
  };

  // ============ 轮播控制 ============
  
  WidgetEngine.prototype.handlePrev = function() {
    this.prev();
  };

  WidgetEngine.prototype.handleNext = function() {
    this.next();
  };

  WidgetEngine.prototype.handleDotClick = function(e) {
    var index = parseInt(e.target.dataset.index, 10);
    this.goTo(index);
  };

  WidgetEngine.prototype.handleMouseEnter = function() {
    this.stopAutoPlay();
  };

  WidgetEngine.prototype.handleMouseLeave = function() {
    if (this.config.autoPlay) {
      this.startAutoPlay();
    }
  };

  WidgetEngine.prototype.handleResize = function() {
    this.updateCarousel();
  };

  WidgetEngine.prototype.goTo = function(index) {
    if (index < 0) index = this.mentions.length - 1;
    if (index >= this.mentions.length) index = 0;
    
    this.currentIndex = index;
    this.updateCarousel();
  };

  WidgetEngine.prototype.next = function() {
    this.goTo(this.currentIndex + 1);
  };

  WidgetEngine.prototype.prev = function() {
    this.goTo(this.currentIndex - 1);
  };

  WidgetEngine.prototype.updateCarousel = function() {
    var track = this.container.querySelector('.ew-carousel-track');
    var items = this.container.querySelectorAll('.ew-item');
    var dots = this.container.querySelectorAll('.ew-dot');
    
    if (!track) return;
    
    // 移动轨道
    var translateX = -this.currentIndex * 100;
    track.style.transform = 'translateX(' + translateX + '%)';
    
    // 更新激活状态
    items.forEach(function(item, i) {
      item.classList.toggle('ew-active', i === this.currentIndex);
    }, this);
    
    dots.forEach(function(dot, i) {
      dot.classList.toggle('active', i === this.currentIndex);
    }, this);
    
    // 发送高度更新
    this.notifyResize();
  };

  // ============ 自动播放 ============
  
  WidgetEngine.prototype.startAutoPlay = function() {
    if (this.mentions.length <= 1) return;
    this.stopAutoPlay();
    
    var self = this;
    this.autoPlayTimer = setInterval(function() {
      self.next();
    }, this.config.autoPlayInterval || 5000);
  };

  WidgetEngine.prototype.stopAutoPlay = function() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  };

  // ============ 通信 ============
  
  WidgetEngine.prototype.notifyResize = function() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'RESIZE',
        height: this.container.scrollHeight
      }, '*');
    }
  };

  // ============ 公共 API ============
  
  WidgetEngine.prototype.refresh = function() {
    this.renderLoading();
    this.fetchData();
  };

  WidgetEngine.prototype.destroy = function() {
    this.stopAutoPlay();
    window.removeEventListener('resize', this.handleResize);
    this.container.innerHTML = '';
  };

  // ============ 初始化入口 ============
  
  function init(container, config) {
    // 如果是 Shadow DOM，创建内部容器
    var root = container.querySelector('.ew-widget-root') || container;
    return new WidgetEngine(root, config);
  }

  // iframe 模式初始化
  if (window.self !== window.top) {
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'INIT') {
        var container = document.getElementById('ew-widget') || document.body;
        init(container, event.data.config);
        
        // 通知父窗口已就绪
        window.parent.postMessage({ type: 'READY' }, '*');
      }
    });
  }

  return {
    init: init,
    WidgetEngine: WidgetEngine,
    Templates: Templates
  };
});
