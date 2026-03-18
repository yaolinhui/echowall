/**
 * 去重系统测试
 */

import { DeduplicationEngine } from '../deduplication-engine';
import { Content } from '../types';

describe('DeduplicationEngine', () => {
  let engine: DeduplicationEngine;

  beforeEach(() => {
    engine = new DeduplicationEngine({
      useBloomFilter: true,
    });
  });

  const createContent = (id: string, text: string): Content => ({
    id,
    platform: 'twitter',
    contentType: 'tweet',
    authorId: 'user_123',
    authorName: 'TestUser',
    content: text,
    url: `https://example.com/${id}`,
    publishedAt: new Date(),
    fetchedAt: new Date(),
    metadata: {},
  });

  describe('Exact Duplicate Detection', () => {
    it('should detect exact duplicates', async () => {
      const content1 = createContent('1', 'This is a test content');
      const content2 = createContent('2', 'This is a test content');

      await engine.addContent(content1);
      const result = await engine.checkDuplicate(content2);

      expect(result.isDuplicate).toBe(true);
      expect(result.level).toBe('exact');
      expect(result.method).toBe('exact_hash');
    });

    it('should not flag different content as duplicate', async () => {
      const content1 = createContent('1', 'This is a test content');
      const content2 = createContent('2', 'This is completely different');

      await engine.addContent(content1);
      const result = await engine.checkDuplicate(content2);

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Near Duplicate Detection', () => {
    it('should detect near duplicates with SimHash', async () => {
      const content1 = createContent('1', 'React 19 is released with new features including improved Suspense and better performance');
      const content2 = createContent('2', 'React 19 is released with new features including improved Suspense and better performance!');

      await engine.addContent(content1);
      const result = await engine.checkDuplicate(content2);

      // 应该检测到近似重复
      expect(result.method).toContain('simhash');
    });

    it('should detect similar content with MinHash', async () => {
      const content1 = createContent('1', 'The quick brown fox jumps over the lazy dog');
      const content2 = createContent('2', 'The quick brown fox jumps over the lazy dog and runs away');

      await engine.addContent(content1);
      const result = await engine.checkDuplicate(content2);

      expect(result.similarityScore).toBeGreaterThan(0.5);
    });
  });

  describe('Semantic Duplicate Detection', () => {
    it('should detect semantically similar content', async () => {
      const content1 = createContent('1', 'React 19 has been released with many improvements');
      const content2 = createContent('2', 'The new version of React, version 19, brings lots of enhancements');

      await engine.addContent(content1);
      const result = await engine.checkDuplicate(content2);

      // 语义相似度应该较高
      expect(result.method).toBe('semantic');
    });
  });

  describe('Find Similar', () => {
    it('should find similar contents', async () => {
      const contents = [
        createContent('1', 'Machine learning is transforming the tech industry'),
        createContent('2', 'Machine learning is revolutionizing the technology sector'),
        createContent('3', 'The weather is nice today'),
        createContent('4', 'Deep learning is a subset of machine learning'),
      ];

      for (const content of contents) {
        await engine.addContent(content);
      }

      const query = createContent('query', 'AI and machine learning are changing technology');
      const results = await engine.findSimilar(query, { topK: 3 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0);
    });
  });

  describe('Stats', () => {
    it('should return correct stats', async () => {
      const content = createContent('1', 'Test content');
      await engine.addContent(content);

      const stats = engine.getStats();

      expect(stats.totalContents).toBe(1);
      expect(stats.exactHashes).toBe(1);
      expect(stats.simHashIndex).toBe(1);
      expect(stats.minHashIndex).toBe(1);
    });
  });
});
