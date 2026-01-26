# Development Guide / 開發指南

## Project Structure / 專案結構

```
gcp-network-planner/
├── frontend/         # Frontend App (React + Vite)
└── backend/          # Backend API (Node.js + Express + Prisma)
```

## Quick Start / 快速啟動

### Option 1: Using Root Scripts / 使用根目錄腳本（建議）

```bash
# Install all dependencies
npm install

# Start frontend (http://localhost:3000)
npm run dev:frontend

# Start backend (http://localhost:3001)
npm run dev:backend

# Start both
npm run dev
```

### Option 2: Individual Workspace / 個別工作區

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm run dev
```

## Frontend Development / 前端開發

The frontend is a React application built with Vite.

### Key Files / 主要檔案

- `App.tsx` - Main application component
- `components/` - Reusable React components
- `services/` - API integration and data fetching
- `utils/` - Utility functions (CIDR parsing, etc.)
- `types.ts` - TypeScript type definitions

### Environment Variables / 環境變數

Create `frontend/.env.local`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
VITE_API_URL=http://localhost:3001
```

### Build / 建置

```bash
npm run build:frontend
```

## Backend Development / 後端開發

The backend is a Node.js Express API with Prisma ORM.

### Key Files / 主要檔案

- `src/server.ts` - Express server entry point
- `src/routes/` - API endpoint handlers
- `src/services/` - Business logic (GCP integration, credentials)
- `src/utils/` - Utilities (encryption, database)
- `prisma/schema.prisma` - Database schema

### Environment Variables / 環境變數

Create `backend/.env` from `backend/.env.example`:
```bash
DATABASE_URL="file:./dev.db"
ENCRYPTION_KEY=your_64_char_hex_key_here
PORT=3001
CORS_ORIGINS="http://localhost:3000"
```

### Database Operations / 資料庫操作

```bash
# Generate Prisma client
npm run backend:db:generate

# Run migrations
npm run backend:db:migrate

# Open Prisma Studio (database GUI)
npm run backend:db:studio
```

## Docker Development / Docker 開發

See [DOCKER.md](./DOCKER.md) for Docker setup.

## Troubleshooting / 疑難排解

### Port Already in Use / 端口已被使用

```bash
# Check what's using port 3000
lsof -i:3000

# Check what's using port 3001
lsof -i:3001

# Kill process
kill -9 <PID>
```

### Module Installation Issues / 模組安裝問題

```bash
# Clear node_modules and reinstall
rm -rf frontend/node_modules backend/node_modules node_modules
rm -f package-lock.json frontend/package-lock.json backend/package-lock.json
npm install
```

### Database Connection Issues / 資料庫連線問題

```bash
# Reset database (WARNING: deletes data)
cd backend
rm -f dev.db
npm run prisma:migrate
```
