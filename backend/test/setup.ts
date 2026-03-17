import { config } from 'dotenv';

// 加载测试环境变量
config({ path: '.env.test' });

// Mock 环境变量
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// 全局 Mock
global.console = {
  ...console,
  // 测试中忽略 console.log，保留 error
  log: jest.fn(),
  warn: jest.fn(),
  error: console.error,
};
