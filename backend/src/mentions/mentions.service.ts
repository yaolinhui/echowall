import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mention, MentionStatus } from './entities/mention.entity';
import { CreateMentionDto } from './dto/create-mention.dto';
import { UpdateMentionDto } from './dto/update-mention.dto';

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(Mention)
    private mentionRepository: Repository<Mention>,
  ) {}

  async create(createMentionDto: CreateMentionDto): Promise<Mention> {
    const mention = this.mentionRepository.create(createMentionDto);
    return this.mentionRepository.save(mention);
  }

  async findAll(): Promise<Mention[]> {
    return this.mentionRepository.find({
      relations: ['project'],
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Mention> {
    const mention = await this.mentionRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['project'],
    });
    if (!mention) {
      throw new NotFoundException('Mention not found');
    }
    return mention;
  }

  async findByProjectId(
    projectId: string,
    status?: MentionStatus,
    limit: number = 50,
  ): Promise<Mention[]> {
    const where: any = { projectId, isDeleted: false };
    if (status) {
      where.status = status;
    }
    return this.mentionRepository.find({
      where,
      order: { postedAt: 'DESC' },
      take: limit,
    });
  }

  async findApprovedByProjectId(projectId: string, limit: number = 50): Promise<Mention[]> {
    return this.findByProjectId(projectId, 'approved', limit);
  }

  async update(id: string, updateMentionDto: UpdateMentionDto): Promise<Mention> {
    const mention = await this.findOne(id);
    Object.assign(mention, updateMentionDto);
    return this.mentionRepository.save(mention);
  }

  async remove(id: string): Promise<void> {
    const mention = await this.findOne(id);
    mention.isDeleted = true;
    await this.mentionRepository.save(mention);
  }

  async bulkUpdateStatus(ids: string[], status: MentionStatus): Promise<void> {
    await this.mentionRepository.update(ids, { status });
  }

  async existsByExternalId(externalId: string): Promise<boolean> {
    const count = await this.mentionRepository.count({
      where: { externalId },
    });
    return count > 0;
  }
}
