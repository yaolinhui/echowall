import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { CreateMentionDto } from './dto/create-mention.dto';
import { UpdateMentionDto } from './dto/update-mention.dto';

@Controller('mentions')
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Post()
  create(@Body() createMentionDto: CreateMentionDto) {
    return this.mentionsService.create(createMentionDto);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: 'pending' | 'approved' | 'rejected' | 'featured',
    @Query('limit') limit?: string,
  ) {
    if (projectId) {
      return this.mentionsService.findByProjectId(
        projectId,
        status,
        limit ? parseInt(limit, 10) : 50,
      );
    }
    return this.mentionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mentionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMentionDto: UpdateMentionDto) {
    return this.mentionsService.update(id, updateMentionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mentionsService.remove(id);
  }

  @Post('bulk-update')
  bulkUpdate(
    @Body('ids') ids: string[],
    @Body('status') status: 'pending' | 'approved' | 'rejected' | 'featured',
  ) {
    return this.mentionsService.bulkUpdateStatus(ids, status);
  }
}
