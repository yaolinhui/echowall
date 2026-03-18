# KudosWall 本地开发运行指南

> 本指南介绍如何在本地环境中完整运行 KudosWall 应用

---

## 📋 前置要求

### 必需环境

| 工具 | 版本要求 | 下载链接 |
|------|---------|---------|
| Node.js | >= 20.x | https://nodejs.org/ |
| npm | >= 10.x | 随 Node.js 安装 |
| Git | >= 2.x | https://git-scm.com/ |

### 可选（推荐）

| 工具 | 用途 |
|------|------|
| Docker | 运行 PostgreSQL + Redis |
| VS Code | 推荐的 IDE |

---

## 🚀 方式一：Docker 一键运行（推荐）

最简单的方式，无需配置数据库。

### 1. 克隆项目

```bash
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall
```

### 2. 配置环境变量

```bash
# 后端环境
cp backend/.env.example backend/.env

# 前端环境  
cp frontend/.env.example frontend/.env
```

### 3. 启动服务

```bash
# 启动 PostgreSQL、Redis、后端和前端
docker-compose up -d
```

### 4. 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端管理后台 | http://localhost:3000 | 主要使用界面 |
| 后端 API | http://localhost:3001/api | API 接口 |
| API 文档 | http://localhost:3001/api/docs | Swagger 文档 |

### 5. 查看日志

```bash
# 所有服务日志
docker-compose logs -f

# 仅后端日志
docker-compose logs -f backend

# 仅前端日志
docker-compose logs -f frontend
```

### 6. 停止服务

```bash
docker-compose down

# 完全清理（包括数据库数据）
docker-compose down -v
```

---

## 💻 方式二：本地开发模式（推荐开发者）

适合需要修改代码的开发者，支持热重载。

### 1. 克隆并安装依赖

```bash
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 2. 启动数据库（使用 Docker）

```bash
# 在项目根目录
docker-compose up -d postgres redis

# 或使用 Makefile
cd ..
make docker-up
```

这将启动：
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env`：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=kudoswall

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 密钥（生产环境请使用强密钥）
JWT_SECRET=your-secret-key

# OpenAI API Key（可选，用于情感分析）
OPENAI_API_KEY=sk-xxx
```

前端环境变量（默认即可）：
```bash
cd ../frontend
cp .env.example .env
```

### 4. 启动后端服务

```bash
cd backend

# 开发模式（热重载）
npm run start:dev

# 服务启动后输出：
# [Nest] 12345  - 2026/03/17 10:00:00     LOG [NestApplication] Nest application successfully started on port 3001
```

### 5. 启动前端服务（新开终端）

```bash
cd frontend

# 开发服务器
npm run dev

# 启动后输出：
# VITE v5.x.x  ready in 300 ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

### 6. 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3001/api
- **Swagger 文档**: http://localhost:3001/api/docs

---

## 🛠️ 方式三：VS Code 调试运行

### 1. 安装扩展

推荐安装以下 VS Code 扩展：
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Thunder Client（API 测试）

### 2. 配置调试

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "args": ["${workspaceFolder}/backend/src/main.ts"],
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}/backend",
      "protocol": "inspector"
    }
  ]
}
```

### 3. 使用 VS Code 终端

按 `` Ctrl+` `` 打开终端，分割窗口同时运行前后端：

```bash
# 终端 1: 后端
cd backend && npm run start:dev

# 终端 2: 前端
cd frontend && npm run dev
```

---

## 📁 项目结构说明

```
KudosWall/
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── main.ts         # 应用入口
│   │   ├── users/          # 用户模块
│   │   ├── projects/       # 项目模块
│   │   ├── sources/        # 数据源模块
│   │   ├── mentions/       # 提及模块
│   │   └── fetcher/        # 定时抓取服务
│   └── .env                # 环境变量
├── frontend/                # React 前端
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   └── services/       # API 服务
│   └── .env                # 环境变量
├── docker-compose.yml       # Docker 配置
└── Makefile                # 快捷命令
```

---

## 🔧 常用开发命令

### Makefile 快捷命令

```bash
# 安装所有依赖
make install

# 启动开发环境（Docker + 本地服务）
make dev

# 构建生产版本
make build

# 运行代码检查
make lint

# 查看测试覆盖率
make coverage

# 清理所有构建文件
make clean
```

### 后端命令

```bash
cd backend

# 开发模式（热重载）
npm run start:dev

# 调试模式
npm run start:debug

# 生产模式
npm run build
npm run start:prod

# 数据库迁移（如需要）
npm run typeorm:migration:generate -- -n MigrationName
npm run typeorm:migration:run
```

### 前端命令

```bash
cd frontend

# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

---

## 🐛 常见问题

### 问题 1: 端口被占用

**错误**：
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决**：
```bash
# 查找占用端口的进程
# Windows:
netstat -ano | findstr :3001
taskkill /PID <进程ID> /F

# Mac/Linux:
lsof -ti:3001 | xargs kill -9
```

### 问题 2: 数据库连接失败

**错误**：
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决**：
```bash
# 确保 PostgreSQL 容器正在运行
docker-compose ps

# 如果没有运行，启动它
docker-compose up -d postgres

# 检查数据库是否创建
docker-compose exec postgres psql -U postgres -l
```

### 问题 3: Node 版本不兼容

**错误**：
```
error: The engine "node" is incompatible with this module
```

**解决**：
```bash
# 使用 nvm 切换版本
nvm use 20

# 或安装指定版本
nvm install 20
nvm use 20
```

### 问题 4: 前端无法连接后端

**检查**：
1. 后端是否运行在 3001 端口
2. 前端 `.env` 中的 API URL 是否正确
3. 浏览器控制台是否有 CORS 错误

**解决**：
```bash
# 检查后端状态
curl http://localhost:3001/api/health

# 查看前端环境变量
cat frontend/.env
```

### 问题 5: 依赖安装失败

**解决**：
```bash
# 清理缓存并重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 📝 环境变量说明

### 后端 `.env`

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 5432 |
| `DB_USERNAME` | 数据库用户名 | postgres |
| `DB_PASSWORD` | 数据库密码 | postgres |
| `DB_DATABASE` | 数据库名 | kudoswall |
| `REDIS_HOST` | Redis 主机 | localhost |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `PORT` | 后端服务端口 | 3001 |

### 前端 `.env`

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_URL` | 后端 API 地址 | http://localhost:3001/api |

---

## 🔄 开发工作流

### 日常开发步骤

```bash
# 1. 启动数据库
docker-compose up -d postgres redis

# 2. 启动后端（终端 1）
cd backend && npm run start:dev

# 3. 启动前端（终端 2）
cd frontend && npm run dev

# 4. 在浏览器中访问 http://localhost:5173

# 5. 修改代码，保存后自动热重载

# 6. 提交前运行测试
make test
```

### 添加新功能流程

1. 创建功能分支
2. 编写代码 + 测试
3. 本地验证运行正常
4. 提交 PR

---

## 📞 获取帮助

- 查看 [GitHub Issues](https://github.com/yaolinhui/kudoswall/issues)
- 阅读 [API 文档](http://localhost:3001/api/docs)（服务启动后）
- 参考 [测试指南](./LOCAL_TESTING_GUIDE.md)

---

**Happy Coding!** 🚀✨
