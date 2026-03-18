import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Inject, forwardRef } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { FetcherService } from '../fetcher/fetcher.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

@Controller('sources')
export class SourcesController {
  constructor(
    private readonly sourcesService: SourcesService,
    @Inject(forwardRef(() => FetcherService))
    private readonly fetcherService: FetcherService,
  ) {}

  @Post()
  async create(@Body() createSourceDto: CreateSourceDto) {
    const source = await this.sourcesService.create(createSourceDto);
    // 自动触发抓取任务
    await this.fetcherService.scheduleFetch(source.id);
    return source;
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    if (projectId) {
      return this.sourcesService.findByProjectId(projectId);
    }
    return this.sourcesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sourcesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSourceDto: UpdateSourceDto) {
    return this.sourcesService.update(id, updateSourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sourcesService.remove(id);
  }
}
