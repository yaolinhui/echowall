import { IsString, IsOptional, IsUUID, IsObject, IsEnum, IsBoolean } from 'class-validator';
import { PlatformType } from '../entities/source.entity';

export class CreateSourceDto {
  @IsEnum(['github', 'producthunt', 'twitter', 'zhihu', 'xiaohongshu'])
  platform: PlatformType;

  @IsString()
  name: string;

  @IsObject()
  config: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsUUID()
  projectId: string;
}
