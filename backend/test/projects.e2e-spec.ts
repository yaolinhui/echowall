import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { ProjectsModule } from '../src/projects/projects.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { Project } from '../src/projects/entities/project.entity';
import { Source } from '../src/sources/entities/source.entity';
import { Mention } from '../src/mentions/entities/mention.entity';

describe('ProjectsController (e2e)', () => {
  let app: INestApplication;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Project, Source, Mention],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, Project]),
        UsersModule,
        ProjectsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
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
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/api/projects (POST)', () => {
    it('should create a new project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          name: 'Test Project',
          description: 'A test project description',
          website: 'https://example.com',
          userId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Project');
      expect(response.body.description).toBe('A test project description');
      expect(response.body.userId).toBe(userId);
      
      projectId = response.body.id;
    });

    it('should fail with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          name: '',
          userId,
        })
        .expect(400);
    });

    it('should fail without required userId', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          name: 'Test Project',
        })
        .expect(400);
    });
  });

  describe('/api/projects (GET)', () => {
    it('should return all projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter projects by userId', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .query({ userId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((project) => {
        expect(project.userId).toBe(userId);
      });
    });
  });

  describe('/api/projects/:id (GET)', () => {
    it('should return a project by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body.name).toBe('Test Project');
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/api/projects/invalid-uuid')
        .expect(404);
    });
  });

  describe('/api/projects/:id (PATCH)', () => {
    it('should update a project', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .send({
          name: 'Updated Project Name',
          widgetConfig: {
            theme: 'dark',
            layout: 'grid',
            maxItems: 20,
            autoPlay: false,
          },
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Project Name');
      expect(response.body.widgetConfig.theme).toBe('dark');
      expect(response.body.widgetConfig.layout).toBe('grid');
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .patch('/api/projects/invalid-uuid')
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('/api/projects/:id (DELETE)', () => {
    it('should delete a project', async () => {
      await request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .expect(200);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .expect(404);
    });
  });
});
