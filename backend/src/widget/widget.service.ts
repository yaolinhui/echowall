import { Injectable, NotFoundException } from '@nestjs/common';
import { MentionsService } from '../mentions/mentions.service';
import { ProjectsService } from '../projects/projects.service';
import { Mention } from '../mentions/entities/mention.entity';

export interface WidgetData {
  project: {
    name: string;
    website?: string;
  };
  mentions: Mention[];
  config: {
    theme: string;
    layout: string;
    maxItems: number;
    autoPlay: boolean;
  };
}

@Injectable()
export class WidgetService {
  constructor(
    private mentionsService: MentionsService,
    private projectsService: ProjectsService,
  ) {}

  async getWidgetData(projectId: string): Promise<WidgetData> {
    const project = await this.projectsService.findOne(projectId);
    
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const mentions = await this.mentionsService.findApprovedByProjectId(
      projectId,
      project.widgetConfig?.maxItems || 10,
    );

    return {
      project: {
        name: project.name,
        website: project.website,
      },
      mentions,
      config: {
        theme: project.widgetConfig?.theme || 'light',
        layout: project.widgetConfig?.layout || 'carousel',
        maxItems: project.widgetConfig?.maxItems || 10,
        autoPlay: project.widgetConfig?.autoPlay ?? true,
      },
    };
  }

  generateEmbedCode(projectId: string): string {
    return `<!-- EchoWall Widget -->
<div id="echowall-widget" data-echowall="${projectId}"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.echowall.io/widget.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
  }
}
