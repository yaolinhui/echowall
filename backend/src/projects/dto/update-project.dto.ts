import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsBoolean()
  isActive?: boolean;
}
