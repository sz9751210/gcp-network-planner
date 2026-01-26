<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GCP Network Planner / Google Cloud 網路規劃工具

Google Cloud Network visualization and management tool with encrypted service account credential storage.

Google Cloud 網路視覺化與管理工具，支援加密服務帳號憑證存儲。

View your app in AI Studio: https://ai.studio/apps/drive/1IQ3BZgXgKWa0G9c_3kuTk8oyi3P_XJh9

---

## 📋 Table of Contents / 目錄

- [Features / 功能特性](#features-功能特性)
- [Architecture / 架構](#architecture-架構)
- [Quick Start with Docker / Docker 快速啟動](#quick-start-with-docker--docker-快速啟動)
- [Development Setup / 開發設置](#development-setup-開發設置)
- [API Endpoints / API 端點](#api-endpoints--api-端點)
- [Security / 安全性](#security-安全性)
- [Project Structure / 專案結構](#project-structure-專案結構)

---

## Features / 功能特性

### English

- **Visualize GCP Network Infrastructure**: VPC networks, subnets, and peering connections
- **Firewall Management**: View and analyze firewall rules
- **Compute Inventory**: Track GCE instances across projects
- **Network Topology Analysis**: Understand connectivity and routing
- **Encrypted Credential Storage**: AES-256-GCM encryption for service account keys
- **CIDR Planning**: Plan IP address allocation with conflict detection
- **GKE Management**: View clusters, workloads, and services
- **Load Balancer & Cloud Armor**: Inventory of network services

### 繁體中文

- **GCP 網路基礎設施視覺化**：VPC 網路、子網路和對等連線
- **防火牆管理**：查看和分析防火牆規則
- **運算實例清單**：追蹤專案中的 GCE 實例
- **網路拓撲分析**：了解連線和路由
- **加密憑證儲存**：使用 AES-256-GCM 加密服務帳號金鑰
- **CIDR 規劃**：規劃 IP 位址配置並偵測衝突
- **GKE 管理**：查看叢集、工作負載和服務
- **負載平衡器與 Cloud Armor**：網路服務清單

---

## Architecture / 架構

### English

```
┌─────────────────┐
│   Frontend     │  React + Vite (Port 3000)
│   (Browser)    │
└────────┬────────┘
         │
         │ HTTP/JSON
         │
    ┌────────┴─────────┐
    │   Backend API   │  Node.js + Express (Port 3001)
    │                │
    │  ┌─────────────┐
    │  │  Prisma ORM  │
    │  │  (SQLite)     │
    │  └─────────────┘
    └─────────────────┘
```

### 繁體中文

```
┌─────────────────┐
│   前端         │  React + Vite (端口 3000)
│   (瀏覽器)     │
└────────┬────────┘
         │
         │ HTTP/JSON
         │
    ┌────────┴─────────┐
    │   後端 API    │  Node.js + Express (端口 3001)
    │                │
    │  ┌─────────────┐
    │  │  Prisma ORM  │
    │  │  (SQLite)     │
    │  └─────────────┘
    └─────────────────┘
```

---

## Quick Start with Docker / Docker 快速啟動

### English

**Prerequisites:** Docker, Docker Compose

```bash
# Set encryption key (generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export ENCRYPTION_KEY="your_64_char_hex_key_here"

# Build and start all services
docker compose up --build

# Access to application
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# Health check: http://localhost:3001/health
```

### 繁體中文

**前置需求：** Docker, Docker Compose

```bash
# 設定加密金鑰（使用以下命令生成：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
export ENCRYPTION_KEY="your_64_char_hex_key_here"

# 建置並啟動所有服務
docker compose up --build

# 存取應用程式
# 前端: http://localhost:3000
# 後端: http://localhost:3001
# 健康檢查: http://localhost:3001/health
```

---

## Development Setup / 開發設置

### English

**Prerequisites:** Node.js 18+

#### Frontend / 前端

```bash
cd frontend

# Install dependencies
npm install

# Set API key for AI features
echo "GEMINI_API_KEY=your_gemini_key_here" > .env.local

# Start frontend dev server
npm run dev
```

#### Backend / 後端

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env and configure:
#   - DATABASE_URL (SQLite: file:./dev.db)
#   - ENCRYPTION_KEY (64-char hex string)
#   - PORT (default: 3001)

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start backend dev server
npm run dev
```

#### Using Root Scripts (From Root / 使用根目錄腳本)

```bash
# Install all dependencies
npm install

# Start frontend (http://localhost:3000)
npm run dev:frontend

# Start backend (http://localhost:3001)
npm run dev:backend

# Start both in separate terminals
npm run dev
```

### 繁體中文

**前置需求：** Node.js 18+

#### Frontend / 前端

```bash
cd frontend

# 安裝依賴
npm install

# 設定 AI 功能的 API 金鑰
echo "GEMINI_API_KEY=your_gemini_key_here" > .env.local

# 啟動前端開發伺服器
npm run dev
```

#### Backend / 後端

```bash
cd backend

# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env 並配置：
#   - DATABASE_URL (SQLite: file:./dev.db)
#   - ENCRYPTION_KEY (64 字元十六進位字串)
#   - PORT (預設: 3001)

# 生成 Prisma Client
npm run prisma:generate

# 執行資料庫遷移
npm run prisma:migrate

# 啟動後端開發伺服器
npm run dev
```

#### Using Root Scripts / 使用根目錄腳本

```bash
# 安裝所有依賴
npm install

# 啟動前端 (http://localhost:3000)
npm run dev:frontend

# 啟動後端 (http://localhost:3001)
npm run dev:backend

# 同時啟動兩者（在不同終端機）
npm run dev
```

---

## API Endpoints / API 端點

### Credentials Management / 憑證管理

| Method | 端點 | 說明 | Description |
|---------|-----------|-------------|-------------|
| POST | `/api/credentials` | 建立服務帳號 | Create service account with encrypted credentials |
| GET | `/api/credentials` | 列出所有服務帳號 | List all service accounts |
| GET | `/api/credentials/:id` | 取得服務帳號詳情 | Get service account details |
| DELETE | `/api/credentials/:id` | 刪除服務帳號 | Delete service account (soft delete) |
| POST | `/api/credentials/:id/test` | 測試 GCP 連線 | Test GCP connection |

### GCP Data / GCP 資料

| Method | 端點 | 說明 | Description |
|---------|-----------|-------------|-------------|
| GET | `/api/gcp?serviceAccountId=:id` | 取得所有 GCP 專案 | Fetch all GCP projects |
| GET | `/api/gcp/all-data?serviceAccountId=:id` | 取得所有專案資料 | Fetch all project data (VPCs, instances, firewalls) |
| GET | `/api/gcp/:projectId/vpcs?serviceAccountId=:id` | 取得 VPC | Fetch VPCs for a project |
| GET | `/api/gcp/:projectId/firewalls?serviceAccountId=:id` | 取得防火牆規則 | Fetch firewall rules |
| GET | `/api/gcp/:projectId/instances?serviceAccountId=:id` | 取得運算實例 | Fetch compute instances |

---

## Security / 安全性

### English

- **AES-256-GCM Encryption**: Service account credentials encrypted before database storage
- **PBKDF2 Key Derivation**: 100,000 iterations with salt for each operation
- **Per-operation Salt & IV**: Maximum security for each encrypted value
- **CORS Configuration**: Configured for specific origins
- **Helmet.js**: Security headers
- **Soft Delete**: `isActive` flag for data recovery
- **Environment Variables**: Never commit `.env` files to version control

### 繁體中文

- **AES-256-GCM 加密**：服務帳號憑證在存入資料庫前進行加密
- **PBKDF2 金鑰衍生**：每次操作使用 100,000 次疊代與鹽值
- **每次操作的鹽值與 IV**：為每個加密值提供最大安全性
- **CORS 配置**：為特定的來源進行配置
- **Helmet.js**：安全性標頭
- **軟刪除**：使用 `isActive` 旗標進行資料復原
- **環境變數**：絕不將 `.env` 檔案提交到版本控制

---

## Project Structure / 專案結構

### English

```
gcp-network-planner/
├── package.json          # Root workspace (monorepo)
├── AGENTS.md           # Agent guidelines / Agent 指南
├── README.md           # Project documentation (bilingual) / 專案說明文件（雙語言）
├── DEVELOPMENT.md     # Development guide (bilingual) / 開發指南（雙語言）
├── DOCKER.md          # Docker deployment guide (bilingual) / Docker 部署指南（雙語言）
├── .dockerignore       # Docker build ignore / Docker 建置忽略
├── docker-compose.yml  # Docker Compose configuration / Docker Compose 配置
├── nginx.conf         # Nginx reverse proxy config / Nginx 反向代理配置
├── .gitignore         # Git ignore / Git 忽略
└── backend/           # Backend API (Node.js + Express + Prisma) / 後端 API
    ├── src/
    │   ├── server.ts           # Express server entry point
    │   ├── routes/            # API endpoint handlers / API 端點處理器
    │   ├── services/          # Business logic (GCP integration, credentials) / 業務邏輯（GCP 整合、憑證管理）
    │   ├── utils/             # Utilities (encryption, database) / 工具（加密、資料庫）
    │   └── types/             # TypeScript types / TypeScript 類型
    ├── prisma/
    │   ├── schema.prisma      # Database schema / 資料庫綱要
    │   ├── seed.ts            # Database seed script / 資料庫種子腳本
    │   └── migrations/        # Database migrations / 資料庫遷移
    ├── package.json         # Backend dependencies / 後端依賴
    ├── tsconfig.json       # Backend TypeScript config / 後端 TypeScript 配置
    ├── Dockerfile          # Backend Dockerfile / 後端 Dockerfile
    └── .env               # Environment variables / 環境變數
└── frontend/           # Frontend App (React + Vite) / 前端應用程式（React + Vite）
    ├── App.tsx            # Main React component / 主要 React 組件
    ├── components/         # React components / React 組件
    ├── services/           # Frontend services / 前端服務
    ├── utils/              # Utility functions / 工具函數
    ├── types.ts            # TypeScript interfaces / TypeScript 介面
    ├── index.tsx           # Entry point / 進入點
    ├── index.html          # HTML template / HTML 樣板
    ├── vite.config.ts       # Vite configuration / Vite 配置
    ├── tsconfig.json       # TypeScript config / TypeScript 配置
    ├── package.json        # Frontend dependencies / 前端依賴
    └── Dockerfile         # Frontend Dockerfile / 前端 Dockerfile
```

### 繁體中文

```
gcp-network-planner/
├── package.json          # 根工作區（monorepo）
├── AGENTS.md           # Agent 指南
├── README.md           # 專案說明文件（雙語言）
├── DEVELOPMENT.md     # 開發指南（雙語言）
├── DOCKER.md          # Docker 部署指南（雙語言）
├── .dockerignore       # Docker 建置忽略
├── docker-compose.yml  # Docker Compose 配置
├── nginx.conf         # Nginx 反向代理配置
├── .gitignore         # Git 忽略
└── backend/           # 後端 API（Node.js + Express + Prisma）
    ├── src/
    │   ├── server.ts           # Express 伺服器進入點
    │   ├── routes/            # API 端點處理器
    │   ├── services/          # 業務邏輯（GCP 整合、憑證管理）
    │   ├── utils/             # 工具（加密、資料庫）
    │   └── types/             # TypeScript 類型
    ├── prisma/
    │   ├── schema.prisma      # 資料庫綱要
    │   ├── seed.ts            # 資料庫種子腳本
    │   └── migrations/        # 資料庫遷移
    ├── package.json         # 後端依賴
    ├── tsconfig.json       # 後端 TypeScript 配置
    ├── Dockerfile          # 後端 Dockerfile
    └── .env               # 環境變數
└── frontend/           # 前端應用程式（React + Vite）
    ├── App.tsx            # 主要 React 組件
    ├── components/         # React 組件
    ├── services/           # 前端服務
    ├── utils/              # 工具函數
    ├── types.ts            # TypeScript 介面
    ├── index.tsx           # 進入點
    ├── index.html          # HTML 樣板
    ├── vite.config.ts       # Vite 配置
    ├── tsconfig.json       # TypeScript 配置
    ├── package.json        # 前端依賴
    └── Dockerfile         # 前端 Dockerfile
```

---

## Production Deployment / 生產部署

### English

For production deployment, refer to [DOCKER.md](./DOCKER.md) for detailed Docker setup.

**Important Security Notes:**

1. **Generate secure encryption key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update environment variables** in `.env` or `docker-compose.override.yml`:
   ```bash
   FRONTEND_URL=https://app.yourdomain.com
   API_URL=https://api.yourdomain.com
   ENCRYPTION_KEY=use_generated_key_from_step_1
   ```

3. **Use PostgreSQL** for production (update `backend/prisma/schema.prisma`)

### 繁體中文

有關生產部署，請參考 [DOCKER.md](./DOCKER.md) 以取得詳細的 Docker 設定。

**重要安全提示：**

1. **生成安全的加密金鑰**：
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **更新環境變數**於 `.env` 或 `docker-compose.override.yml`：
   ```bash
   FRONTEND_URL=https://app.yourdomain.com
   API_URL=https://api.yourdomain.com
   ENCRYPTION_KEY=使用步驟1生成的金鑰
   ```

3. **使用 PostgreSQL** 用於生產（更新 `backend/prisma/schema.prisma`）

---

## License / 授權

MIT
