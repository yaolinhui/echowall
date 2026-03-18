import { IsString, IsOptional, IsUUID, IsObject, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsObject()
  widgetConfig?: {
    theme?: string;
    layout?: 'carousel' | 'grid' | 'list';
    maxItems?: number;
    autoPlay?: boolean;
  };

  @IsOptional()
  @IsString()
  userId?: string;
}
