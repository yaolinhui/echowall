import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

export type SentimentType = 'positive' | 'neutral' | 'negative';
export type MentionStatus = 'pending' | 'approved' | 'rejected' | 'featured';

@Entity('mentions')
export class Mention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  platform: string;

  @Column()
  externalId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  rawContent: string | null;

  @Column({ nullable: true })
  authorName: string;

  @Column({ nullable: true })
  authorAvatar: string;

  @Column({ nullable: true })
  authorUrl: string;

  @Column({ nullable: true })
  sourceUrl: string;

  @Column({ type: 'datetime', nullable: true })
  postedAt: Date;

  @Column({
    type: 'text',
    default: 'neutral',
  })
  sentiment: SentimentType;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  sentimentScore: number;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status: MentionStatus;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  isDeleted: boolean;

  @ManyToOne(() => Project, (project) => project.mentions)
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
