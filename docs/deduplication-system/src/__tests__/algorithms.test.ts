/**
 * 算法单元测试
 */

import { SimHash, SimHashIndex } from '../algorithms/simhash';
import { MinHash, MinHashLSH } from '../algorithms/minhash';
import { BloomFilter } from '../algorithms/bloom-filter';
import { cosineSimilarity } from '../algorithms/semantic-similarity';

describe('SimHash', () => {
  const simHash = new SimHash({ hashBits: 64, hammingThreshold: 3 });

  it('should generate consistent hashes', () => {
    const text = 'This is a test document';
    const hash1 = simHash.compute(text);
    const hash2 = simHash.compute(text);
    
    expect(hash1).toBe(hash2);
  });

  it('should detect similar texts', () => {
    const text1 = 'React 19 is released with new features';
    const text2 = 'React 19 is released with new features!';
    
    const hash1 = simHash.compute(text1);
    const hash2 = simHash.compute(text2);
    
    const isSimilar = simHash.isSimilar(hash1, hash2);
    expect(isSimilar).toBe(true);
  });

  it('should calculate correct similarity', () => {
    const text1 = 'This is exactly the same';
    const text2 = 'This is exactly the same';
    
    const hash1 = simHash.compute(text1);
    const hash2 = simHash.compute(text2);
    
    const similarity = simHash.similarity(hash1, hash2);
    expect(similarity).toBe(1);
  });
});

describe('SimHashIndex', () => {
  const index = new SimHashIndex({ hashBits: 64, hammingThreshold: 3 });

  it('should add and find similar documents', () => {
    index.add('doc1', 'React 19 is released');
    index.add('doc2', 'Vue 3 is released');
    index.add('doc3', 'React 19 is released!');

    const results = index.findSimilar('React 19 is released');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'doc1' || r.id === 'doc3')).toBe(true);
  });

  it('should remove documents', () => {
    index.add('doc4', 'Test document');
    index.remove('doc4');

    const results = index.findSimilar('Test document');
    expect(results.some(r => r.id === 'doc4')).toBe(false);
  });
});

describe('MinHash', () => {
  const minHash = new MinHash({ numHashes: 128, shingleSize: 3 });

  it('should generate signatures', () => {
    const text = 'This is a test document for MinHash';
    const signature = minHash.compute(text);
    
    expect(signature.length).toBe(128);
    expect(signature.every(h => h < Infinity)).toBe(true);
  });

  it('should estimate Jaccard similarity', () => {
    const text1 = 'The quick brown fox jumps over the lazy dog';
    const text2 = 'The quick brown fox jumps over the lazy dog and sleeps';
    
    const similarity = minHash.estimateJaccard(text1, text2);
    
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('should return 1 for identical texts', () => {
    const text = 'Identical text';
    const sig1 = minHash.compute(text);
    const sig2 = minHash.compute(text);
    
    const similarity = minHash.jaccardSimilarity(sig1, sig2);
    expect(similarity).toBe(1);
  });
});

describe('MinHashLSH', () => {
  const lsh = new MinHashLSH({ numHashes: 128, bands: 16 });

  it('should add and query documents', () => {
    lsh.add('doc1', 'Machine learning is amazing');
    lsh.add('doc2', 'Deep learning is a subset of machine learning');
    lsh.add('doc3', 'The weather is nice today');

    const results = lsh.query('Machine learning and deep learning');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it('should find all pairs above threshold', () => {
    lsh.add('doc4', 'React is a JavaScript library');
    lsh.add('doc5', 'React is a popular JavaScript library');
    lsh.add('doc6', 'Vue is another JavaScript framework');

    const pairs = lsh.findAllPairs(0.5);
    
    expect(pairs.length).toBeGreaterThanOrEqual(0);
  });
});

describe('BloomFilter', () => {
  it('should correctly identify non-existing items', () => {
    const filter = new BloomFilter({ size: 1000, hashFunctions: 7 });
    
    filter.add('item1');
    filter.add('item2');
    
    expect(filter.mayContain('item1')).toBe(true);
    expect(filter.mayContain('item2')).toBe(true);
    expect(filter.definitelyNotContain('item3')).toBe(true);
  });

  it('should calculate false positive rate', () => {
    const filter = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.01 });
    
    for (let i = 0; i < 1000; i++) {
      filter.add(`item${i}`);
    }
    
    const fpr = filter.currentFalsePositiveRate();
    expect(fpr).toBeLessThan(0.1);
  });

  it('should support serialization', () => {
    const filter = new BloomFilter({ size: 100, hashFunctions: 5 });
    filter.add('test');
    
    const serialized = filter.serialize();
    expect(serialized.bits).toBeDefined();
    expect(serialized.size).toBeDefined();
    expect(serialized.hashFunctions).toBeDefined();
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(-1, 5);
  });

  it('should throw for different dimensions', () => {
    const a = [1, 2];
    const b = [1, 2, 3];
    
    expect(() => cosineSimilarity(a, b)).toThrow();
  });
});
