import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects.service';
import { Project } from '../entities/project.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: Repository<Project>;

  const mockProject: Project = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Project',
    description: 'A test project',
    website: 'https://example.com',
    widgetConfig: {
      theme: 'light',
      layout: 'carousel',
      maxItems: 10,
      autoPlay: true,
    },
    isActive: true,
    userId: 'user-id',
    user: null,
    sources: [],
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockReturnValue(mockProject),
    save: jest.fn().mockResolvedValue(mockProject),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    repository = module.get<Repository<Project>>(getRepositoryToken(Project));
    
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createProjectDto = {
      name: 'Test Project',
      description: 'A test project',
      website: 'https://example.com',
      userId: 'user-id',
    };

    it('should create a new project successfully', async () => {
      const result = await service.create(createProjectDto);

      expect(repository.create).toHaveBeenCalledWith(createProjectDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });
  });

  describe('findAll', () => {
    it('should return all projects with relations', async () => {
      const projects = [mockProject];
      mockRepository.find.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        relations: ['sources', 'mentions'],
      });
      expect(result).toEqual(projects);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.findOne(mockProject.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        relations: ['sources', 'mentions', 'user'],
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return projects for a user', async () => {
      const projects = [mockProject];
      mockRepository.find.mockResolvedValue(projects);

      const result = await service.findByUserId('user-id');

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        relations: ['sources'],
      });
      expect(result).toEqual(projects);
    });
  });

  describe('update', () => {
    const updateProjectDto = {
      name: 'Updated Project',
      widgetConfig: {
        theme: 'dark',
        layout: 'grid',
        maxItems: 20,
        autoPlay: false,
      },
    };

    it('should update project successfully', async () => {
      const updatedProject = { ...mockProject, ...updateProjectDto };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(updatedProject);

      const result = await service.update(mockProject.id, updateProjectDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toEqual('Updated Project');
      expect(result.widgetConfig.theme).toEqual('dark');
    });
  });

  describe('remove', () => {
    it('should remove project successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);

      await service.remove(mockProject.id);

      expect(repository.remove).toHaveBeenCalledWith(mockProject);
    });
  });
});
