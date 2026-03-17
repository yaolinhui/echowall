import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentionsService } from './mentions.service';
import { MentionsController } from './mentions.controller';
import { Mention } from './entities/mention.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mention])],
  controllers: [MentionsController],
  providers: [MentionsService],
  exports: [MentionsService],
})
export class MentionsModule {}
