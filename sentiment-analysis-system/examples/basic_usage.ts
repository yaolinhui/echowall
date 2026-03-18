/**
 * 基础使用示例
 */

import { SentimentAnalyzer } from '../src/core/SentimentAnalyzer';
import { AnalysisRequest, SentimentLabel } from '../src/core/types';

async function basicExample() {
  // 创建分析器实例
  const analyzer = new SentimentAnalyzer();

  // 示例文本
  const examples: AnalysisRequest[] = [
    { text: '这个产品真的很棒，使用体验非常好！' },
    { text: '太糟糕了，完全没法用，浪费钱。' },
    { text: '还可以吧，没什么特别的。' },
    { text: 'Great product, love it!' },
    { text: 'This is the worst app I have ever used.' },
    { text: '太棒了，一天崩溃三次！', options: { requireSarcasmCheck: true } },
    { text: 'The UI is beautiful but the performance is terrible.' },
    { text: '这个API文档写得真清楚，看了三天没看懂', options: { requireSarcasmCheck: true } },
  ];

  console.log('=== 多语言情感分析示例 ===\n');

  for (const example of examples) {
    console.log(`输入: "${example.text}"`);
    
    const result = await analyzer.analyze(example);
    
    console.log(`  语言: ${result.language}`);
    console.log(`  情感: ${result.label} (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`  分数: 正${(result.scores.positive * 100).toFixed(1)}% / 负${(result.scores.negative * 100).toFixed(1)}% / 中${(result.scores.neutral * 100).toFixed(1)}%`);
    console.log(`  处理层: ${result.processingLayer}`);
    console.log(`  延迟: ${result.latency.toFixed(2)}ms`);
    
    if (result.sarcasm) {
      console.log(`  讽刺检测: ${result.sarcasm.isSarcastic ? '是' : '否'} (置信度: ${(result.sarcasm.confidence * 100).toFixed(1)}%)`);
      if (result.sarcasm.cues) {
        console.log(`  讽刺线索: ${result.sarcasm.cues.join(', ')}`);
      }
    }
    
    console.log('');
  }
}

async function batchExample() {
  const analyzer = new SentimentAnalyzer();

  const texts = [
    '非常好用！',
    '太差了',
    '还可以',
    'Amazing product!',
    'Not bad',
    '一般般吧',
  ];

  const requests = texts.map((text) => ({ text }));

  console.log('=== 批量分析示例 ===\n');

  const startTime = Date.now();
  const results = await analyzer.analyzeBatch(requests, { parallel: true });
  const totalTime = Date.now() - startTime;

  results.forEach((result, i) => {
    console.log(`${i + 1}. "${texts[i]}" -> ${result.label} (${(result.confidence * 100).toFixed(0)}%)`);
  });

  console.log(`\n总耗时: ${totalTime}ms, 平均: ${(totalTime / texts.length).toFixed(2)}ms/条`);
}

async function sarcasmExample() {
  const analyzer = new SentimentAnalyzer();

  const sarcasticTexts = [
    { text: '太棒了，一天崩溃三次', desc: '表面赞美，实际抱怨' },
    { text: '这个bug真厉害，怎么都修不好', desc: '讽刺性表达' },
    { text: '响应速度真快，等了十分钟', desc: '反讽' },
    { text: '呵呵，真厉害', desc: '网络讽刺用语' },
    { text: 'Wonderful, it crashed again!', desc: '英文讽刺' },
    { text: '真不错，推荐给所有想浪费时间的人', desc: '隐晦讽刺' },
  ];

  console.log('=== 讽刺检测示例 ===\n');

  for (const { text, desc } of sarcasticTexts) {
    const result = await analyzer.analyze({
      text,
      options: { requireSarcasmCheck: true },
    });

    console.log(`文本: "${text}"`);
    console.log(`说明: ${desc}`);
    console.log(`预测情感: ${result.label}`);
    console.log(`讽刺检测: ${result.sarcasm?.isSarcastic ? '✓ 检测到讽刺' : '✗ 未检测到'}`);
    console.log(`讽刺置信度: ${((result.sarcasm?.confidence || 0) * 100).toFixed(1)}%`);
    console.log('');
  }
}

async function complexityExample() {
  const { ComplexityAssessor } = await import('../src/utils/ComplexityAssessor');
  const { LanguageDetector } = await import('../src/utils/LanguageDetector');

  const assessor = new ComplexityAssessor();
  const langDetector = new LanguageDetector();

  const texts = [
    { text: '好', desc: '极短文本' },
    { text: '这个产品不错', desc: '简单短句' },
    { text: '虽然界面很漂亮，但是功能太复杂了，学习成本很高', desc: '转折复杂句' },
    { text: "The API documentation is comprehensive but the rate limiting is quite restrictive for high-throughput applications", desc: '英文长句' },
    { text: '用了这个工具之后，我的bug不仅没有减少，反而越来越多了，真是无语', desc: '含讽刺的复杂句' },
  ];

  console.log('=== 复杂度评估示例 ===\n');

  for (const { text, desc } of texts) {
    const lang = langDetector.detect(text);
    const analysis = assessor.getDetailedAnalysis(text, lang);

    console.log(`文本: "${text}" (${desc})`);
    console.log(`语言: ${lang}`);
    console.log(`复杂度: ${analysis.totalScore.toFixed(2)} (${analysis.level})`);
    console.log(`  - 长度: ${analysis.factors.length.toFixed(2)}`);
    console.log(`  - 词汇: ${analysis.factors.vocabulary.toFixed(2)}`);
    console.log(`  - 结构: ${analysis.factors.structure.toFixed(2)}`);
    console.log(`  - 情感: ${analysis.factors.sentiment.toFixed(2)}`);
    console.log(`  - 上下文: ${analysis.factors.context.toFixed(2)}`);
    console.log(`建议: ${analysis.recommendation}`);
    console.log('');
  }
}

// 运行示例
async function main() {
  try {
    await basicExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await batchExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await sarcasmExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await complexityExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main();
}
