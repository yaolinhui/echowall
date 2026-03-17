import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDate,
} from 'class-validator';
import { SentimentType, MentionStatus } from '../entities/mention.entity';

export class CreateMentionDto {
  @IsString()
  platform: string;

  @IsString()
  externalId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  rawContent?: string;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  authorAvatar?: string;

  @IsOptional()
  @IsString()
  authorUrl?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  postedAt?: Date;

  @IsOptional()
  @IsEnum(['positive', 'neutral', 'negative'])
  sentiment?: SentimentType;

  @IsOptional()
  @IsNumber()
  sentimentScore?: number;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'featured'])
  status?: MentionStatus;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsUUID()
  projectId: string;
}
