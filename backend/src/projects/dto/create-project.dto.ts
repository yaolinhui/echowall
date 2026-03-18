import { IsString, IsOptional, IsUUID, IsObject, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
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

  @IsString()
  @IsNotEmpty()
  userId: string;
}
