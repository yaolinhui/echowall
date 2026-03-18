# EchoWall 快速开始（无需 Docker）

> 适合没有安装 Docker 的 Windows/macOS/Linux 用户

---

## ⚡ 5分钟快速启动

### 1. 克隆项目

```bash
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall
```

### 2. 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd ../frontend && npm install
```

> 如果已经安装过，可以跳过此步骤

### 3. 启动后端（终端 1）

```bash
cd backend
npm run start:dev
```

等待看到：
```
[Nest] xxx  -  LOG [NestApplication] Nest application successfully started on port 3001
```

### 4. 启动前端（终端 2，新开窗口）

```bash
cd frontend
npm run dev
```

等待看到：
```
VITE x.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 5. 访问应用

打开浏览器：**http://localhost:5173**

---

## 🔧 环境说明

### 数据库
- **使用 SQLite 内存数据库**（无需安装 PostgreSQL）
- 数据存储在内存中，重启后重置
- 适合开发和测试

### 队列
- **使用内存队列**（无需安装 Redis）
- 后台任务正常运行

### 端口
- 前端：http://localhost:5173
- 后端 API：http://localhost:3001/api

---

## 📝 常见问题

### 端口 3001 被占用

```powershell
# Windows 查看占用
netstat -ano | findstr :3001

# 结束进程
taskkill /PID <进程ID> /F
```

### 如何切换到 PostgreSQL（可选）

如需数据持久化，安装 [Docker Desktop](https://www.docker.com/products/docker-desktop) 后：

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d postgres redis

# 修改 backend/.env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=kudoswall

# 重新启动后端
```

---

**Done!** 🎉 开始开发吧！
