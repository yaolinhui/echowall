import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { MentionsModule } from '../mentions/mentions.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [MentionsModule, ProjectsModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
