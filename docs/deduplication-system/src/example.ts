/**
 * 使用示例
 */

import {
  DeduplicationEngine,
  VersionManager,
  AuthorResolver,
  Content,
  Platform,
} from './index';

async function main() {
  console.log('=== 跨平台内容去重系统示例 ===\n');

  // 初始化引擎
  const engine = new DeduplicationEngine({
    config: {
      simHash: { hammingThreshold: 3 },
      minHash: { jaccardThreshold: 0.85 },
      semantic: { cosineThreshold: 0.92 },
    },
    useBloomFilter: true,
  });

  const versionManager = new VersionManager({
    maxVersionsPerContent: 10,
    keepDiffHistory: true,
  });

  const authorResolver = new AuthorResolver(0.75);

  // 模拟测试内容
  const testContents: Content[] = [
    {
      id: 'twitter_1',
      platform: 'twitter' as Platform,
      contentType: 'tweet',
      authorId: 'user_twitter_123',
      authorName: 'TechBlogger',
      content: 'React 19 发布了！新特性包括：\n- 改进的Suspense\n- 新的Compiler\n- 更好的性能\n\n#React #WebDev',
      url: 'https://twitter.com/techblogger/status/1',
      publishedAt: new Date('2024-01-15 10:00:00'),
      fetchedAt: new Date(),
      metadata: {},
    },
    // 近似重复（轻微修改）
    {
      id: 'weibo_1',
      platform: 'weibo' as Platform,
      contentType: 'post',
      authorId: 'user_weibo_456',
      authorName: '前端小能手',
      content: 'React 19 正式发布！主要新特性：\n- 改进的Suspense\n- 全新的Compiler\n- 更优秀的性能\n\n#React #前端开发',
      url: 'https://weibo.com/frontend/123',
      publishedAt: new Date('2024-01-15 11:30:00'),
      fetchedAt: new Date(),
      metadata: {},
    },
    // 语义相似但不同表达
    {
      id: 'github_1',
      platform: 'github' as Platform,
      contentType: 'issue',
      authorId: 'user_github_789',
      authorName: 'developer-joe',
      content: 'React 19 announcement: The latest version brings significant improvements to Suspense, introduces a new Compiler for optimized builds, and delivers better overall performance.',
      url: 'https://github.com/facebook/react/discussions/123',
      publishedAt: new Date('2024-01-15 12:00:00'),
      fetchedAt: new Date(),
      metadata: {},
    },
    // 完全不同的内容
    {
      id: 'zhihu_1',
      platform: 'zhihu' as Platform,
      contentType: 'article',
      authorId: 'user_zhihu_321',
      authorName: 'AI研究者',
      content: '深度学习在计算机视觉领域的最新进展：\n1. 多模态大模型的发展\n2. 视觉Transformer的优化\n3. 自监督学习的突破',
      url: 'https://zhihu.com/p/ai-vision-2024',
      publishedAt: new Date('2024-01-15 14:00:00'),
      fetchedAt: new Date(),
      metadata: {},
    },
  ];

  // 演示1：添加内容并检查重复
  console.log('【演示1】内容去重检测');
  console.log('=' .repeat(50));

  for (const content of testContents) {
    console.log(`\n处理内容: ${content.id} (${content.platform})`);
    console.log(`作者: ${content.authorName}`);
    console.log(`内容: ${content.content.substring(0, 50)}...`);

    // 检查重复
    const result = await engine.checkDuplicate(content);
    console.log(`\n去重结果:`);
    console.log(`  - 是否重复: ${result.isDuplicate}`);
    console.log(`  - 级别: ${result.level}`);
    console.log(`  - 置信度: ${(result.confidence * 100).toFixed(2)}%`);
    console.log(`  - 检测方法: ${result.method}`);
    
    if (result.matchedContentId) {
      console.log(`  - 匹配内容: ${result.matchedContentId}`);
    }

    // 如果不是重复，添加到索引
    if (!result.isDuplicate) {
      await engine.addContent(content);
      
      // 注册版本
      const version = versionManager.registerContent(content);
      console.log(`  - 版本ID: ${version.id}`);
    } else {
      // 注册为镜像
      if (result.matchedContentId) {
        const version = versionManager.registerMirror(
          content,
          result.matchedContentId,
          content.platform
        );
        console.log(`  - 注册为镜像, 版本ID: ${version.id}`);
      }
    }
  }

  // 演示2：查找相似内容
  console.log('\n\n【演示2】查找相似内容');
  console.log('=' .repeat(50));

  const queryContent: Content = {
    id: 'query_1',
    platform: 'twitter',
    contentType: 'tweet',
    authorId: 'query_user',
    authorName: 'QueryUser',
    content: 'React 19 is out with Suspense improvements and new Compiler!',
    url: '',
    publishedAt: new Date(),
    fetchedAt: new Date(),
    metadata: {},
  };

  const similarContents = await engine.findSimilar(queryContent, {
    topK: 3,
    checkExact: true,
    checkSimHash: true,
    checkMinHash: true,
    checkSemantic: true,
  });

  console.log('\n查询内容:', queryContent.content);
  console.log('\n相似内容:');
  similarContents.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.id} - ${(result.similarity * 100).toFixed(2)}% (${result.method})`);
  });

  // 演示3：作者识别
  console.log('\n\n【演示3】跨平台作者识别');
  console.log('=' .repeat(50));

  const authorIdentifiers = [
    {
      platform: 'twitter',
      userId: 'user_twitter_123',
      username: 'techblogger',
      displayName: 'TechBlogger',
      bio: '前端开发者 | React贡献者 | 开源爱好者',
      metadata: {
        writingStats: {
          avgSentenceLength: 15,
          punctuationRatio: 0.1,
          emojiRatio: 0.05,
        },
        activityHours: [9, 10, 14, 15, 20, 21],
      },
    },
    {
      platform: 'github',
      userId: 'user_github_789',
      username: 'techblogger-dev',
      displayName: 'Tech Blogger',
      bio: 'Frontend developer. React contributor. Open source enthusiast.',
      metadata: {
        writingStats: {
          avgSentenceLength: 12,
          punctuationRatio: 0.08,
          emojiRatio: 0.02,
        },
        activityHours: [9, 10, 14, 15, 20, 22],
      },
    },
    {
      platform: 'weibo',
      userId: 'user_weibo_456',
      username: '前端小能手',
      displayName: '前端小能手',
      bio: '热爱前端，专注React和Vue',
      metadata: {
        writingStats: {
          avgSentenceLength: 10,
          punctuationRatio: 0.12,
          emojiRatio: 0.08,
        },
        activityHours: [10, 11, 15, 16, 21],
      },
    },
  ];

  for (const identifier of authorIdentifiers) {
    const result = await authorResolver.resolve(identifier);
    console.log(`\n平台: ${identifier.platform}`);
    console.log(`用户名: ${identifier.username}`);
    console.log(`识别结果:`);
    console.log(`  - 档案ID: ${result.profileId}`);
    console.log(`  - 置信度: ${(result.confidence * 100).toFixed(2)}%`);
    console.log(`  - 是否新作者: ${result.isNewAuthor}`);
    
    if (!result.isNewAuthor) {
      console.log(`  - 关联账号数: ${result.matchedIdentifiers.length}`);
    }
  }

  // 演示4：版本管理
  console.log('\n\n【演示4】内容版本管理');
  console.log('=' .repeat(50));

  // 模拟内容更新
  const updatedContent: Content = {
    ...testContents[0],
    id: 'twitter_1_updated',
    content: 'React 19 发布了！新特性包括：\n- 改进的Suspense\n- 新的Compiler\n- 更好的性能\n- 全新的use hook\n\n#React #WebDev #JavaScript',
  };

  const updatedVersion = versionManager.registerUpdate(
    updatedContent,
    testContents[0].id
  );

  console.log('\n原始内容ID:', testContents[0].id);
  console.log('更新后内容ID:', updatedContent.id);
  console.log('版本信息:');
  console.log(`  - 版本号: ${updatedVersion.version}`);
  console.log(`  - 关系: ${updatedVersion.relation}`);
  console.log(`  - 父内容: ${updatedVersion.parentId}`);
  
  if (updatedVersion.diff) {
    console.log('\n变更内容:');
    console.log(`  - 新增: ${updatedVersion.diff.added.length} 行`);
    console.log(`  - 删除: ${updatedVersion.diff.removed.length} 行`);
    console.log(`  - 修改: ${updatedVersion.diff.modified.length} 处`);
  }

  // 获取内容谱系
  const lineage = versionManager.getLineage(updatedContent.id);
  console.log('\n内容谱系:');
  console.log(`  - 祖先: ${lineage.ancestors.length} 个`);
  console.log(`  - 自身版本: ${lineage.self.length} 个`);
  console.log(`  - 后代: ${lineage.descendants.length} 个`);

  // 演示5：统计信息
  console.log('\n\n【演示5】系统统计');
  console.log('=' .repeat(50));

  const engineStats = engine.getStats();
  console.log('\n去重引擎统计:');
  console.log(`  - 总内容数: ${engineStats.totalContents}`);
  console.log(`  - 精确哈希数: ${engineStats.exactHashes}`);
  console.log(`  - SimHash索引: ${engineStats.simHashIndex}`);
  console.log(`  - MinHash索引: ${engineStats.minHashIndex}`);
  if (engineStats.bloomFilterItemCount !== undefined) {
    console.log(`  - Bloom Filter项目: ${engineStats.bloomFilterItemCount}`);
  }

  const versionStats = versionManager.getStats();
  console.log('\n版本管理统计:');
  console.log(`  - 总版本数: ${versionStats.totalVersions}`);
  console.log(`  - 唯一内容: ${versionStats.uniqueContents}`);
  console.log(`  - Canonical组: ${versionStats.canonicalGroups}`);

  console.log('\n=== 示例结束 ===');
}

// 运行示例
main().catch(console.error);
