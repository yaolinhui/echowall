/**
 * EchoWall Widget Build Script
 * 构建脚本 - 用于打包和优化 Widget 资源
 */

const fs = require('fs');
const path = require('path');

// 构建配置
const config = {
  srcDir: './src',
  distDir: './dist',
  files: [
    'embed.js',
    'core/widget-core.js',
    'core/communicator.js',
    'styles/core.css'
  ]
};

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 复制文件
function copyFile(src, dest) {
  const content = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dest, content);
  console.log(`✓ Copied: ${src} -> ${dest}`);
  return content.length;
}

// 简单的 JS 压缩
function minifyJS(code) {
  return code
    // 移除单行注释
    .replace(/\/\/.*$/gm, '')
    // 移除多行注释
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 移除多余空白
    .replace(/\n\s*\n/g, '\n')
    // 移除行首空格
    .replace(/^\s+/gm, '')
    // 压缩多余空格
    .replace(/\s+/g, ' ')
    // 移除最后的多余空格
    .trim();
}

// 简单的 CSS 压缩
function minifyCSS(code) {
  return code
    // 移除注释
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 移除多余空白
    .replace(/\s+/g, ' ')
    // 移除选择器前后空格
    .replace(/\s*([{}:;,])\s*/g, '$1')
    // 移除最后一个分号
    .replace(/;}/g, '}')
    .trim();
}

// 计算 gzip 大小（估算）
function estimateGzipSize(content) {
  // 简单估算：压缩率约 70%
  return Math.round(content.length * 0.3);
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// 主构建函数
function build() {
  console.log('\n🏗️  EchoWall Widget Build\n');
  
  // 确保 dist 目录存在
  ensureDir(config.distDir);
  ensureDir(path.join(config.distDir, 'core'));
  ensureDir(path.join(config.distDir, 'styles'));
  
  const stats = {
    files: 0,
    totalSize: 0,
    minifiedSize: 0
  };
  
  // 处理每个文件
  config.files.forEach(file => {
    const srcPath = path.join(config.srcDir, file);
    const distPath = path.join(config.distDir, file);
    
    // 确保目标目录存在
    ensureDir(path.dirname(distPath));
    
    if (!fs.existsSync(srcPath)) {
      console.log(`⚠️  Skipped (not found): ${file}`);
      return;
    }
    
    let content = fs.readFileSync(srcPath, 'utf8');
    const originalSize = content.length;
    
    // 根据文件类型压缩
    let minified = content;
    if (file.endsWith('.js')) {
      minified = minifyJS(content);
    } else if (file.endsWith('.css')) {
      minified = minifyCSS(content);
    }
    
    // 写入压缩版本
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const minFileName = `${baseName}.min${ext}`;
    const minPath = path.join(config.distDir, path.dirname(file), minFileName);
    
    fs.writeFileSync(minPath, minified);
    
    const minifiedSize = minified.length;
    const gzipSize = estimateGzipSize(minified);
    
    console.log(`✓ ${file}`);
    console.log(`  Original: ${formatSize(originalSize)}`);
    console.log(`  Minified: ${formatSize(minifiedSize)}`);
    console.log(`  Gzipped:  ${formatSize(gzipSize)}`);
    console.log('');
    
    stats.files++;
    stats.totalSize += originalSize;
    stats.minifiedSize += minifiedSize;
  });
  
  // 生成合并版本（可选）
  createBundle();
  
  // 打印汇总
  console.log('📊 Build Summary');
  console.log('================');
  console.log(`Files processed: ${stats.files}`);
  console.log(`Total original:  ${formatSize(stats.totalSize)}`);
  console.log(`Total minified:  ${formatSize(stats.minifiedSize)}`);
  console.log(`Total gzipped:   ${formatSize(estimateGzipSize(stats.minifiedSize))}`);
  console.log('\n✅ Build complete!\n');
}

// 创建合并版本
function createBundle() {
  console.log('📦 Creating bundle...\n');
  
  const bundleFiles = [
    'src/core/communicator.js',
    'src/core/widget-core.js'
  ];
  
  let bundle = '';
  bundleFiles.forEach(file => {
    if (fs.existsSync(file)) {
      bundle += fs.readFileSync(file, 'utf8') + '\n';
    }
  });
  
  const minified = minifyJS(bundle);
  fs.writeFileSync('./dist/widget.bundle.min.js', minified);
  console.log(`✓ Created: widget.bundle.min.js (${formatSize(minified.length)})\n`);
}

// 创建 package.json（如果不存在）
function initPackageJson() {
  const pkgPath = './package.json';
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: '@echowall/widget',
      version: '2.0.0',
      description: 'EchoWall Widget - Perfect Third-party Widget Embed Solution',
      main: 'dist/embed.js',
      scripts: {
        build: 'node build.js',
        watch: 'node build.js --watch'
      },
      keywords: ['widget', 'embed', 'shadow-dom', 'iframe', 'isolation'],
      license: 'MIT'
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('✓ Created package.json\n');
  }
}

// 运行构建
initPackageJson();
build();
