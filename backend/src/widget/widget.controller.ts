import { Controller, Get, Param, Query, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { WidgetService } from './widget.service';

@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get(':projectId/data')
  async getWidgetData(@Param('projectId') projectId: string) {
    return this.widgetService.getWidgetData(projectId);
  }

  @Get(':projectId/embed')
  getEmbedCode(@Param('projectId') projectId: string) {
    return {
      code: this.widgetService.generateEmbedCode(projectId),
    };
  }

  @Get(':projectId/script.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getWidgetScript(
    @Param('projectId') projectId: string,
    @Res() res: Response,
    @Query('theme') theme?: string,
    @Query('layout') layout?: string,
  ) {
    const data = await this.widgetService.getWidgetData(projectId);
    
    // 生成内联 widget JS
    const script = this.generateWidgetScript(data, theme, layout);
    res.send(script);
  }

  private generateWidgetScript(data: any, theme?: string, layout?: string): string {
    const config = {
      ...data.config,
      theme: theme || data.config.theme,
      layout: layout || data.config.layout,
    };

    return `
(function() {
  'use strict';
  
  const config = ${JSON.stringify(config)};
  const mentions = ${JSON.stringify(data.mentions)};
  const project = ${JSON.stringify(data.project)};
  
  function initKudosWall() {
    const container = document.getElementById('kudoswall-widget');
    if (!container) return;
    
    const widget = document.createElement('div');
    widget.className = 'kudoswall-widget kudoswall-theme-' + config.theme;
    widget.innerHTML = renderMentions();
    container.appendChild(widget);
    
    if (config.layout === 'carousel' && config.autoPlay) {
      initCarousel(widget);
    }
  }
  
  function renderMentions() {
    const items = mentions.map(m => \`
      <div class="kudoswall-item">
        <div class="kudoswall-content">\${m.content}</div>
        <div class="kudoswall-author">
          <img src="\${m.authorAvatar || 'https://cdn.kudoswall.io/default-avatar.png'}" alt="" />
          <a href="\${m.sourceUrl}" target="_blank">\${m.authorName || 'Anonymous'}</a>
          <span class="kudoswall-platform">\${m.platform}</span>
        </div>
      </div>
    \`).join('');
    
    return \`<div class="kudoswall-\${config.layout}">\${items}</div>\`;
  }
  
  function initCarousel(container) {
    let current = 0;
    const items = container.querySelectorAll('.kudoswall-item');
    if (items.length <= 1) return;
    
    setInterval(() => {
      current = (current + 1) % items.length;
      items.forEach((item, i) => {
        item.style.display = i === current ? 'block' : 'none';
      });
    }, 5000);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKudosWall);
  } else {
    initKudosWall();
  }
})();
`;
  }
}
