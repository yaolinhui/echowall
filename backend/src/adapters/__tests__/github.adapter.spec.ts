import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GithubAdapter } from '../github.adapter';

describe('GithubAdapter', () => {
  let adapter: GithubAdapter;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfig = {
    owner: 'facebook',
    repo: 'react',
    token: 'test-token',
    includeIssues: true,
    includeComments: true,
  };

  const mockIssues = [
    {
      id: 1,
      number: 100,
      title: 'Bug report',
      body: 'This is a bug report with great detail about the issue.',
      user: {
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
        html_url: 'https://github.com/testuser',
      },
      html_url: 'https://github.com/facebook/react/issues/100',
      created_at: '2026-03-15T10:00:00Z',
      comments: 5,
    },
    {
      id: 2,
      number: 101,
      title: 'Feature request',
      body: 'Would love to see this feature added!',
      user: {
        login: 'anotheruser',
        avatar_url: 'https://avatars.githubusercontent.com/u/2',
        html_url: 'https://github.com/anotheruser',
      },
      html_url: 'https://github.com/facebook/react/issues/101',
      created_at: '2026-03-14T15:30:00Z',
      comments: 3,
    },
  ];

  // PR 应该被过滤掉
  const mockPullRequest = {
    id: 3,
    number: 102,
    title: 'PR: Add new feature',
    body: 'This PR adds a new feature',
    user: {
      login: 'developer',
      avatar_url: 'https://avatars.githubusercontent.com/u/3',
      html_url: 'https://github.com/developer',
    },
    html_url: 'https://github.com/facebook/react/pull/102',
    created_at: '2026-03-13T08:00:00Z',
    comments: 10,
  };

  const mockComments = [
    {
      id: 1001,
      body: 'Great work on this! The implementation is clean.',
      user: {
        login: 'reviewer1',
        avatar_url: 'https://avatars.githubusercontent.com/u/10',
        html_url: 'https://github.com/reviewer1',
      },
      html_url: 'https://github.com/facebook/react/issues/100#issuecomment-1',
      created_at: '2026-03-15T12:00:00Z',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubAdapter,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    adapter = module.get<GithubAdapter>(GithubAdapter);
    httpService = module.get<HttpService>(HttpService);
    
    jest.clearAllMocks();
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      expect(adapter.validateConfig(mockConfig)).toBe(true);
    });

    it('should return false when owner is missing', () => {
      expect(adapter.validateConfig({ ...mockConfig, owner: '' })).toBe(false);
    });

    it('should return false when repo is missing', () => {
      expect(adapter.validateConfig({ ...mockConfig, repo: '' })).toBe(false);
    });

    it('should return false when all fetch options are false', () => {
      expect(
        adapter.validateConfig({
          ...mockConfig,
          includeIssues: false,
          includeComments: false,
          includeDiscussions: false,
        }),
      ).toBe(false);
    });
  });

  describe('fetch', () => {
    it('should fetch issues and comments successfully', async () => {
      mockHttpService.get
        .mockImplementation((url: string) => {
          if (url.includes('/issues/comments')) {
            return of({ data: mockComments });
          }
          if (url.includes('/issues')) {
            return of({ data: [...mockIssues, mockPullRequest] });
          }
          return throwError(() => new Error('Unknown URL'));
        });

      const result = await adapter.fetch(mockConfig);

      // 应该过滤掉 PR，保留 2 个 issues + 1 个 comment
      expect(result).toHaveLength(3);
      
      // 验证 issues
      const issueResult = result.find((r) => r.externalId === 'github:issue:1');
      expect(issueResult).toBeDefined();
      expect(issueResult?.content).toBe(mockIssues[0].body);
      expect(issueResult?.authorName).toBe('testuser');
      expect(issueResult?.metadata.type).toBe('issue');

      // 验证 PR 被过滤
      const prResult = result.find((r) => r.externalId === 'github:issue:3');
      expect(prResult).toBeUndefined();

      // 验证 comments
      const commentResult = result.find((r) => r.externalId === 'github:comment:1001');
      expect(commentResult).toBeDefined();
      expect(commentResult?.metadata.type).toBe('comment');
    });

    it('should handle API errors gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await adapter.fetch(mockConfig);

      expect(result).toEqual([]);
    });

    it('should handle issues with empty body', async () => {
      const issueWithNullBody = {
        ...mockIssues[0],
        body: null,
      };

      mockHttpService.get.mockReturnValue(
        of({ data: [issueWithNullBody] }),
      );

      const result = await adapter.fetch({ ...mockConfig, includeComments: false });

      expect(result[0].content).toBe(issueWithNullBody.title);
      expect(result[0].rawContent).toBeNull();
    });

    it('should use correct headers with token', async () => {
      mockHttpService.get.mockReturnValue(of({ data: [] }));

      await adapter.fetch(mockConfig);

      const calls = mockHttpService.get.mock.calls;
      expect(calls[0][1].headers).toHaveProperty('Authorization', 'token test-token');
      expect(calls[0][1].headers).toHaveProperty(
        'Accept',
        'application/vnd.github.v3+json',
      );
    });

    it('should work without token', async () => {
      mockHttpService.get.mockReturnValue(of({ data: [] }));

      await adapter.fetch({ ...mockConfig, token: undefined });

      const calls = mockHttpService.get.mock.calls;
      expect(calls[0][1].headers).not.toHaveProperty('Authorization');
    });
  });
});
