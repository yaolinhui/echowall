import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ChromeWebStoreAdapter } from '../chromewebstore.adapter';

describe('ChromeWebStoreAdapter', () => {
  let adapter: ChromeWebStoreAdapter;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfig = {
    extensionId: 'chphlpgkkbolifaimnlloiipkdnihall',
    maxReviews: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChromeWebStoreAdapter,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    adapter = module.get<ChromeWebStoreAdapter>(ChromeWebStoreAdapter);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('platform', () => {
    it('should return chromewebstore as platform', () => {
      expect(adapter.platform).toBe('chromewebstore');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config with extensionId', () => {
      expect(adapter.validateConfig(mockConfig)).toBe(true);
    });

    it('should return false for config without extensionId', () => {
      expect(adapter.validateConfig({})).toBe(false);
      expect(adapter.validateConfig({ maxReviews: 10 })).toBe(false);
    });

    it('should return false for config with empty extensionId', () => {
      expect(adapter.validateConfig({ extensionId: '' })).toBe(false);
    });
  });

  describe('fetch', () => {
    it('should return mock reviews when API fails (fallback)', async () => {
      // 模拟 API 失败
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const mentions = await adapter.fetch(mockConfig);

      expect(mentions).toBeDefined();
      expect(Array.isArray(mentions)).toBe(true);
      expect(mentions.length).toBeGreaterThan(0);

      // 验证返回的数据结构
      const mention = mentions[0];
      expect(mention).toHaveProperty('platform', 'chromewebstore');
      expect(mention).toHaveProperty('externalId');
      expect(mention).toHaveProperty('content');
      expect(mention).toHaveProperty('authorName');
      expect(mention).toHaveProperty('postedAt');
      expect(mention).toHaveProperty('sourceUrl');
      expect(mention).toHaveProperty('metadata');
      expect(mention.metadata).toHaveProperty('isMock', true);
      expect(mention.metadata).toHaveProperty('extensionId', mockConfig.extensionId);
    });

    it('should handle valid HTML response', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="ba-bc-Xb">
              <div>Test Review Content</div>
            </div>
          </body>
        </html>
      `;

      mockHttpService.get.mockReturnValue(
        of({ data: mockHtml, status: 200 }),
      );

      const mentions = await adapter.fetch(mockConfig);

      expect(mentions).toBeDefined();
      expect(Array.isArray(mentions)).toBe(true);
    });

    it('should limit reviews to maxReviews', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const mentions = await adapter.fetch({ extensionId: 'test-id', maxReviews: 2 });

      expect(mentions.length).toBeLessThanOrEqual(2);
    });

    it('should generate correct sourceUrl', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const mentions = await adapter.fetch(mockConfig);

      expect(mentions[0].sourceUrl).toContain(mockConfig.extensionId);
      expect(mentions[0].sourceUrl).toContain('chromewebstore.google.com');
    });
  });
});
