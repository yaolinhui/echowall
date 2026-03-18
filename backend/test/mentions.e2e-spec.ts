import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { MentionsModule } from '../src/mentions/mentions.module';
import { ProjectsModule } from '../src/projects/projects.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { Project } from '../src/projects/entities/project.entity';
import { Mention } from '../src/mentions/entities/mention.entity';
import { Source } from '../src/sources/entities/source.entity';

describe('MentionsController (e2e)', () => {
  let app: INestApplication;
  let userId: string;
  let projectId: string;
  let mentionId: string;

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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    // 创建测试用户
    const userResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
    userId = userResponse.body.id;

    // 创建测试项目
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'Test Project',
        userId,
      });
    projectId = projectResponse.body.id;
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/api/mentions (POST)', () => {
    it('should create a new mention', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/mentions')
        .send({
          platform: 'github',
          externalId: 'github:issue:12345',
          content: 'This is a great project! Love the documentation.',
          rawContent: 'This is a great project! Love the documentation.',
          authorName: 'john_doe',
          authorAvatar: 'https://avatars.githubusercontent.com/u/123',
          authorUrl: 'https://github.com/john_doe',
          sourceUrl: 'https://github.com/user/repo/issues/123',
          postedAt: new Date().toISOString(),
          sentiment: 'positive',
          sentimentScore: 0.85,
          status: 'pending',
          metadata: { type: 'issue', number: 123 },
          projectId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.platform).toBe('github');
      expect(response.body.content).toBe('This is a great project! Love the documentation.');
      expect(response.body.status).toBe('pending');
      
      mentionId = response.body.id;
    });

    it('should fail without required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/mentions')
        .send({
          platform: 'github',
        })
        .expect(400);
    });
  });

  describe('/api/mentions (GET)', () => {
    it('should return all mentions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/mentions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter mentions by projectId', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/mentions')
        .query({ projectId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((mention) => {
        expect(mention.projectId).toBe(projectId);
      });
    });

    it('should filter mentions by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/mentions')
        .query({ projectId, status: 'pending' })
        .expect(200);

      response.body.forEach((mention) => {
        expect(mention.status).toBe('pending');
      });
    });
  });

  describe('/api/mentions/:id (PATCH)', () => {
    it('should update mention status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/mentions/${mentionId}`)
        .send({
          status: 'approved',
          sentimentScore: 0.95,
        })
        .expect(200);

      expect(response.body.status).toBe('approved');
      expect(parseFloat(response.body.sentimentScore)).toBe(0.95);
    });

    it('should feature a mention', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/mentions/${mentionId}`)
        .send({
          status: 'featured',
        })
        .expect(200);

      expect(response.body.status).toBe('featured');
    });
  });

  describe('/api/mentions/bulk-update (POST)', () => {
    it('should bulk update mentions status', async () => {
      // Create another mention
      const mention2 = await request(app.getHttpServer())
        .post('/api/mentions')
        .send({
          platform: 'github',
          externalId: 'github:issue:12346',
          content: 'Another mention',
          projectId,
          status: 'pending',
        });

      const ids = [mentionId, mention2.body.id];

      await request(app.getHttpServer())
        .post('/api/mentions/bulk-update')
        .send({
          ids,
          status: 'approved',
        })
        .expect(201);

      // Verify both mentions are updated
      const response1 = await request(app.getHttpServer())
        .get(`/api/mentions/${mentionId}`);
      expect(response1.body.status).toBe('approved');
    });
  });

  describe('/api/mentions/:id (DELETE)', () => {
    it('should soft delete a mention', async () => {
      await request(app.getHttpServer())
        .delete(`/api/mentions/${mentionId}`)
        .expect(200);

      // 软删除后应该还能查到（使用includeDeleted=true），且 isDeleted 为 true
      const response = await request(app.getHttpServer())
        .get(`/api/mentions/${mentionId}?includeDeleted=true`);
      expect(response.body.isDeleted).toBe(true);
    });
  });
});
