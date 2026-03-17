import { IsOptional, IsEnum, IsNumber } from 'class-validator';
import { SentimentType, MentionStatus } from '../entities/mention.entity';

export class UpdateMentionDto {
  @IsOptional()
  @IsEnum(['positive', 'neutral', 'negative'])
  sentiment?: SentimentType;

  @IsOptional()
  @IsNumber()
  sentimentScore?: number;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'featured'])
  status?: MentionStatus;
}
