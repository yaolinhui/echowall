/**
 * KudosWall Widget v1.0.0
 * A lightweight embeddable widget for displaying social proof
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self), (global.KudosWall = factory()));
})(this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    apiUrl: 'https://api.kudoswall.io',
    theme: 'light',
    layout: 'carousel',
    maxItems: 10,
    autoPlay: true,
    autoPlayInterval: 5000,
  };

  class KudosWallWidget {
    constructor(containerId, projectId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        throw new Error(`KudosWall: Container with id "${containerId}" not found`);
      }

      this.projectId = projectId;
      this.config = { ...DEFAULT_CONFIG, ...options };
      this.mentions = [];
      this.currentIndex = 0;
      this.autoPlayTimer = null;

      this.init();
    }

    async init() {
      this.container.className = `kudoswall-widget kudoswall-theme-${this.config.theme}`;
      
      // Add loading state
      this.container.innerHTML = '<div class="kudoswall-loading">Loading...</div>';

      try {
        await this.fetchData();
        this.render();
        if (this.config.layout === 'carousel' && this.config.autoPlay) {
          this.startAutoPlay();
        }
      } catch (error) {
        this.container.innerHTML = `<div class="kudoswall-error">Failed to load mentions</div>`;
        console.error('KudosWall:', error);
      }
    }

    async fetchData() {
      const response = await fetch(
        `${this.config.apiUrl}/api/widget/${this.projectId}/data`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch widget data');
      }

      const data = await response.json();
      this.mentions = data.mentions.slice(0, this.config.maxItems);
      this.config = { ...this.config, ...data.config };
    }

    render() {
      if (this.mentions.length === 0) {
        this.container.innerHTML = '<div class="kudoswall-empty">No mentions yet</div>';
        return;
      }

      const html = this.getLayoutHTML();
      this.container.innerHTML = html;
      this.attachEventListeners();
    }

    getLayoutHTML() {
      const itemsHTML = this.mentions.map((mention, index) => this.getMentionHTML(mention, index)).join('');

      switch (this.config.layout) {
        case 'grid':
          return `<div class="kudoswall-grid">${itemsHTML}</div>`;
        case 'list':
          return `<div class="kudoswall-list">${itemsHTML}</div>`;
        case 'carousel':
        default:
          return `
            <div class="kudoswall-carousel">
              <div class="kudoswall-carousel-track">${itemsHTML}</div>
              <div class="kudoswall-carousel-nav">
                <button class="kudoswall-prev" aria-label="Previous">&#8249;</button>
                <div class="kudoswall-dots">${this.getDotsHTML()}</div>
                <button class="kudoswall-next" aria-label="Next">&#8250;</button>
              </div>
            </div>
          `;
      }
    }

    getMentionHTML(mention, index) {
      const avatar = mention.authorAvatar || 'https://www.gravatar.com/avatar/?d=mp';
      const author = mention.authorName || 'Anonymous';
      const date = mention.postedAt ? new Date(mention.postedAt).toLocaleDateString() : '';
      const activeClass = this.config.layout === 'carousel' && index === this.currentIndex ? 'kudoswall-active' : '';

      return `
        <div class="kudoswall-item ${activeClass}" data-index="${index}">
          <div class="kudoswall-content">
            <p class="kudoswall-text">${this.escapeHtml(mention.content)}</p>
          </div>
          <div class="kudoswall-footer">
            <div class="kudoswall-author">
              <img src="${avatar}" alt="${author}" class="kudoswall-avatar" loading="lazy" />
              <div class="kudoswall-author-info">
                <a href="${mention.authorUrl || '#'}" target="_blank" rel="noopener" class="kudoswall-author-name">
                  ${author}
                </a>
                <span class="kudoswall-platform">${mention.platform}</span>
              </div>
            </div>
            ${mention.sourceUrl ? `
              <a href="${mention.sourceUrl}" target="_blank" rel="noopener" class="kudoswall-link">
                View
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }

    getDotsHTML() {
      if (this.mentions.length <= 1) return '';
      return this.mentions
        .map((_, i) => `<button class="kudoswall-dot ${i === this.currentIndex ? 'active' : ''}" data-index="${i}"></button>`)
        .join('');
    }

    attachEventListeners() {
      if (this.config.layout !== 'carousel') return;

      const prevBtn = this.container.querySelector('.kudoswall-prev');
      const nextBtn = this.container.querySelector('.kudoswall-next');
      const dots = this.container.querySelectorAll('.kudoswall-dot');

      prevBtn?.addEventListener('click', () => this.prev());
      nextBtn?.addEventListener('click', () => this.next());

      dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.goTo(index);
        });
      });

      // Pause autoplay on hover
      this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
      this.container.addEventListener('mouseleave', () => {
        if (this.config.autoPlay) this.startAutoPlay();
      });
    }

    goTo(index) {
      if (index < 0) index = this.mentions.length - 1;
      if (index >= this.mentions.length) index = 0;

      this.currentIndex = index;
      this.updateCarousel();
    }

    next() {
      this.goTo(this.currentIndex + 1);
    }

    prev() {
      this.goTo(this.currentIndex - 1);
    }

    updateCarousel() {
      const items = this.container.querySelectorAll('.kudoswall-item');
      const dots = this.container.querySelectorAll('.kudoswall-dot');

      items.forEach((item, i) => {
        item.classList.toggle('kudoswall-active', i === this.currentIndex);
      });

      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === this.currentIndex);
      });
    }

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
      this.container.innerHTML = '';
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Auto-initialize widgets
  function autoInit() {
    const containers = document.querySelectorAll('[data-kudoswall]');
    containers.forEach((container) => {
      const projectId = container.getAttribute('data-kudoswall');
      const theme = container.getAttribute('data-theme') || 'light';
      const layout = container.getAttribute('data-layout') || 'carousel';
      const maxItems = parseInt(container.getAttribute('data-max-items') || '10', 10);
      const autoPlay = container.getAttribute('data-autoplay') !== 'false';

      new KudosWallWidget(container.id, projectId, {
        theme,
        layout,
        maxItems,
        autoPlay,
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // Expose API
  return {
    init: (containerId, projectId, options) => new KudosWallWidget(containerId, projectId, options),
    autoInit,
  };
});
