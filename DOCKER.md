# Docker Quick Start / Docker 快速啟動

## One-Command Setup / 一鍵指令設置

```bash
docker compose up --build
```

This will:
- Build and start the backend API (Node.js, port 3001) / 建置並啟動後端 API（Node.js，端口 3001）
- Build and start the frontend (port 3000) / 建置並啟動前端（端口 3000）
- Create a persistent volume for database storage / 為資料庫建立持久化存儲

### Using Go Backend / 使用 Go 後端

The application supports both Node.js and Go backends. To use the Go backend:

### English

```bash
# Start with Go backend
docker compose --profile go up --build

# View logs
docker compose --profile go logs -f

# Stop services
docker compose --profile go down
```

### 繁體中文

```bash
# 使用 Go 後端啟動
docker compose --profile go up --build

# 查看日誌
docker compose --profile go logs -f

# 停止服務
docker compose --profile go down
```

### Backend Comparison / 後端比較

| Feature / 功能 | Node.js Backend | Go Backend |
|---------------|----------------|------------|
| Technology / 技術 | Node.js + Express + Prisma | Go + Echo + GORM |
| Default Profile / 預設配置檔 | `node` | `go` |
| Command to Start / 啟動指令 | `docker compose up` | `docker compose --profile go up` |
| Database Volume / 資料庫卷 | `backend_data` | `go_backend_data` |

## Access / 存取

### English

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

### 繁體中文

- 前端: http://localhost:3000
- 後端 API: http://localhost:3001
- 健康檢查: http://localhost:3001/health

## Environment Variables / 環境變數配置

For production, create a `.env` file in the project root:

### English

```bash
# Frontend
VITE_API_URL=https://api.yourdomain.com

# Backend
ENCRYPTION_KEY=your_64_char_hex_key_here
DATABASE_URL=postgresql://user:password@host:5432/database
```

### 繁體中文

```bash
# 前端
VITE_API_URL=https://api.yourdomain.com

# 後端
ENCRYPTION_KEY=your_64_char_hex_key_here
DATABASE_URL=postgresql://user:password@host:5432/database
```

## Managing Services / 管理服務

### English

```bash
# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild and start
docker compose up --build --force-recreate

# Stop and remove volumes (WARNING: deletes database data)
docker compose down -v
```

### 繁體中文

```bash
# 查看日誌
docker compose logs -f

# 停止服務
docker compose down

# 重新建構並啟動
docker compose up --build --force-recreate

# 停止並移除卷（警告：刪除資料庫數據）
docker compose down -v
```

## Troubleshooting / 疑難排解

### Backend fails to start / 後端啟動失敗

Check backend logs:
```bash
docker compose logs backend
```

Common issue: Invalid `ENCRYPTION_KEY`. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend cannot reach backend / 前端無法連線到後端

Ensure both services are on the same Docker network. The `docker-compose.yml` sets up a shared network automatically.

### Database persistence / 資料庫持久化

Database is stored in Docker volume `gcp-network-planner_backend_data`. To reset:
```bash
docker compose down -v
docker compose up --build
```
