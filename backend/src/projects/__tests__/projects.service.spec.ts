import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects.service';
import { Project } from '../entities/project.entity';
import { User } from '../../users/entities/user.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepository: Repository<Project>;
  let userRepository: Repository<User>;

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

  const mockUser: User = {
    id: 'user-id',
    email: 'test@example.com',
    password: 'hashed-password',
    name: 'Test User',
    avatar: null,
    plan: 'free',
    settings: {},
    projects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockReturnValue(mockProject),
    save: jest.fn().mockResolvedValue(mockProject),
    remove: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn().mockResolvedValue(mockUser),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectRepository = module.get<Repository<Project>>(getRepositoryToken(Project));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    
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
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const result = await service.create(createProjectDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: createProjectDto.userId },
      });
      expect(projectRepository.create).toHaveBeenCalledWith(createProjectDto);
      expect(projectRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createProjectDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all projects with relations', async () => {
      const projects = [mockProject];
      mockProjectRepository.find.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(projectRepository.find).toHaveBeenCalledWith({
        relations: ['sources', 'mentions'],
      });
      expect(result).toEqual(projects);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.findOne(mockProject.id);

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        relations: ['sources', 'mentions', 'user'],
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return projects for a user', async () => {
      const projects = [mockProject];
      mockProjectRepository.find.mockResolvedValue(projects);

      const result = await service.findByUserId('user-id');

      expect(projectRepository.find).toHaveBeenCalledWith({
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
      mockProjectRepository.findOne.mockResolvedValue(mockProject);
      mockProjectRepository.save.mockResolvedValue(updatedProject);

      const result = await service.update(mockProject.id, updateProjectDto);

      expect(projectRepository.save).toHaveBeenCalled();
      expect(result.name).toEqual('Updated Project');
      expect(result.widgetConfig.theme).toEqual('dark');
    });
  });

  describe('remove', () => {
    it('should remove project successfully', async () => {
      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      await service.remove(mockProject.id);

      expect(projectRepository.remove).toHaveBeenCalledWith(mockProject);
    });
  });
});
