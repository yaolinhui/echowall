import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Source, PlatformType } from './entities/source.entity';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

@Injectable()
export class SourcesService {
  constructor(
    @InjectRepository(Source)
    private sourceRepository: Repository<Source>,
  ) {}

  async create(createSourceDto: CreateSourceDto): Promise<Source> {
    const source = this.sourceRepository.create(createSourceDto);
    return this.sourceRepository.save(source);
  }

  async findAll(): Promise<Source[]> {
    return this.sourceRepository.find({
      relations: ['project'],
    });
  }

  async findOne(id: string): Promise<Source> {
    const source = await this.sourceRepository.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!source) {
      throw new NotFoundException('Source not found');
    }
    return source;
  }

  async findByProjectId(projectId: string): Promise<Source[]> {
    return this.sourceRepository.find({
      where: { projectId },
    });
  }

  async findActiveByPlatform(platform: PlatformType): Promise<Source[]> {
    return this.sourceRepository.find({
      where: { platform, isActive: true },
      relations: ['project'],
    });
  }

  async update(id: string, updateSourceDto: UpdateSourceDto): Promise<Source> {
    const source = await this.findOne(id);
    Object.assign(source, updateSourceDto);
    return this.sourceRepository.save(source);
  }

  async updateLastFetched(id: string): Promise<void> {
    await this.sourceRepository.update(id, { lastFetchedAt: new Date() });
  }

  async remove(id: string): Promise<void> {
    const source = await this.findOne(id);
    await this.sourceRepository.remove(source);
  }
}
