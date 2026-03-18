import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { WidgetModule } from '../src/widget/widget.module';
import { MentionsModule } from '../src/mentions/mentions.module';
import { ProjectsModule } from '../src/projects/projects.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { Project } from '../src/projects/entities/project.entity';
import { Mention } from '../src/mentions/entities/mention.entity';
import { Source } from '../src/sources/entities/source.entity';

describe('WidgetController (e2e)', () => {
  let app: INestApplication;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Project, Mention, Source],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, Project, Mention]),
        UsersModule,
        ProjectsModule,
        MentionsModule,
        WidgetModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    // 创建测试数据
    const userResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'My Awesome Project',
        description: 'A project with great reviews',
        website: 'https://example.com',
        widgetConfig: {
          theme: 'light',
          layout: 'carousel',
          maxItems: 5,
          autoPlay: true,
        },
        userId: userResponse.body.id,
      });
    projectId = projectResponse.body.id;

    // 创建一些 mentions
    const mentions = [
      {
        platform: 'github',
        externalId: 'github:1',
        content: 'Love this project!',
        authorName: 'user1',
        status: 'approved',
        sentiment: 'positive',
        sentimentScore: 0.9,
        projectId,
      },
      {
        platform: 'producthunt',
        externalId: 'ph:1',
        content: 'Amazing tool!',
        authorName: 'user2',
        status: 'approved',
        sentiment: 'positive',
        sentimentScore: 0.95,
        projectId,
      },
      {
        platform: 'github',
        externalId: 'github:2',
        content: 'Needs improvement',
        authorName: 'user3',
        status: 'pending', // pending 不应该显示
        sentiment: 'neutral',
        sentimentScore: 0.5,
        projectId,
      },
    ];

    for (const mention of mentions) {
      await request(app.getHttpServer())
        .post('/api/mentions')
        .send(mention);
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/api/widget/:projectId/data (GET)', () => {
    it('should return widget data with approved mentions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/${projectId}/data`)
        .expect(200);

      expect(response.body).toHaveProperty('project');
      expect(response.body).toHaveProperty('mentions');
      expect(response.body).toHaveProperty('config');

      // 验证项目信息
      expect(response.body.project.name).toBe('My Awesome Project');
      expect(response.body.project.website).toBe('https://example.com');

      // 验证配置
      expect(response.body.config.theme).toBe('light');
      expect(response.body.config.layout).toBe('carousel');
      expect(response.body.config.maxItems).toBe(5);

      // 验证只返回 approved 的 mentions
      expect(response.body.mentions).toHaveLength(2);
      response.body.mentions.forEach((mention) => {
        expect(mention.status).toBe('approved');
        expect(mention.sentiment).toBe('positive');
      });
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/api/widget/invalid-uuid/data')
        .expect(404);
    });
  });

  describe('/api/widget/:projectId/embed (GET)', () => {
    it('should return embed code', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/${projectId}/embed`)
        .expect(200);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toContain('echowall-widget');
      expect(response.body.code).toContain(projectId);
      expect(response.body.code).toContain('script');
    });
  });

  describe('/api/widget/:projectId/script.js (GET)', () => {
    it('should return widget script', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/${projectId}/script.js`)
        .expect(200)
        .expect('Content-Type', /javascript/);

      expect(response.text).toContain('EchoWall');
      expect(response.text).toContain('mentions');
    });

    it('should support custom theme via query param', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/${projectId}/script.js?theme=dark`)
        .expect(200);

      expect(response.text).toContain('theme');
    });
  });
});
