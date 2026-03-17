import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SourcesService } from '../sources.service';
import { Source } from '../entities/source.entity';

describe('SourcesService', () => {
  let service: SourcesService;
  let repository: Repository<Source>;

  const mockSource: Source = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    platform: 'github',
    name: 'My GitHub Repo',
    config: {
      owner: 'facebook',
      repo: 'react',
      includeIssues: true,
      includeComments: true,
    },
    isActive: true,
    lastFetchedAt: null,
    projectId: 'project-id',
    project: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockReturnValue(mockSource),
    save: jest.fn().mockResolvedValue(mockSource),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        {
          provide: getRepositoryToken(Source),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
    repository = module.get<Repository<Source>>(getRepositoryToken(Source));
    
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createSourceDto = {
      platform: 'github' as const,
      name: 'My GitHub Repo',
      config: { owner: 'facebook', repo: 'react' },
      projectId: 'project-id',
      isActive: true,
    };

    it('should create a new source successfully', async () => {
      const result = await service.create(createSourceDto);

      expect(repository.create).toHaveBeenCalledWith(createSourceDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSource);
    });
  });

  describe('findActiveByPlatform', () => {
    it('should return active sources for a platform', async () => {
      const sources = [mockSource];
      mockRepository.find.mockResolvedValue(sources);

      const result = await service.findActiveByPlatform('github');

      expect(repository.find).toHaveBeenCalledWith({
        where: { platform: 'github', isActive: true },
        relations: ['project'],
      });
      expect(result).toEqual(sources);
    });
  });

  describe('updateLastFetched', () => {
    it('should update last fetched timestamp', async () => {
      await service.updateLastFetched(mockSource.id);

      expect(repository.update).toHaveBeenCalledWith(
        mockSource.id,
        { lastFetchedAt: expect.any(Date) },
      );
    });
  });

  describe('findByProjectId', () => {
    it('should return sources for a project', async () => {
      const sources = [mockSource];
      mockRepository.find.mockResolvedValue(sources);

      const result = await service.findByProjectId('project-id');

      expect(repository.find).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
      });
      expect(result).toEqual(sources);
    });
  });
});
