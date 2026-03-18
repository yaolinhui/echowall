import { IsString, IsOptional, IsObject, IsEnum, IsBoolean } from 'class-validator';
import type { PlatformType } from '../entities/source.entity';

export class UpdateSourceDto {
  @IsOptional()
  @IsEnum(['github', 'producthunt', 'twitter', 'zhihu', 'xiaohongshu'])
  platform?: PlatformType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
