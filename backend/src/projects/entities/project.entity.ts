import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Source } from '../../sources/entities/source.entity';
import { Mention } from '../../mentions/entities/mention.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  website: string;

  @Column({ type: 'simple-json', nullable: true })
  widgetConfig: {
    theme: string;
    layout: 'carousel' | 'grid' | 'list';
    maxItems: number;
    autoPlay: boolean;
  };

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Source, (source) => source.project)
  sources: Source[];

  @OneToMany(() => Mention, (mention) => mention.project)
  mentions: Mention[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
