# AGENTS.md

Guidelines for AI coding agents operating in this repository.

## Build Commands

### Frontend
```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run preview          # Preview production build
```

### Backend (Node.js)
```bash
cd backend
npm run dev              # Start backend (port 3001)
npm run build            # Compile TypeScript
npm run start            # Run compiled code
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
```

### Go Backend
```bash
cd go-backend
go mod tidy              # Download dependencies
go build -o bin/server ./cmd/main.go  # Build
./bin/server             # Run (port 3001)
make run                 # Build and run
make dev                 # Run with hot reload (requires air)
make clean               # Clean build artifacts

# Testing
make test                # Run all tests
go test -v ./...         # Verbose tests
go test -v ./internal/handlers  # Run tests for specific package
go test -v -run TestName ./...  # Run single test by name

# Code quality
make fmt                 # Format code (go fmt ./...)
make lint                # Lint code (golangci-lint run ./...)
```

### Root
```bash
npm install              # Install all dependencies
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only
```

**Note:** No lint commands configured for frontend. Use `lsp_diagnostics` before completing work.

## Code Style Guidelines

### Import Patterns
```typescript
// External libraries
import React, { useEffect, useState } from 'react';
import { GoogleGenAI } from "@google/genai";

// Local files - use relative paths with explicit extensions
import { GcpProject } from '../types';
import { Dashboard } from './components/Dashboard';

// Path alias available: @/* resolves to project root
import { Layout } from './components/Layout';
```

### TypeScript Conventions
- Use `interface` for props and data models (defined in `types.ts`)
- Prefer union types over enums: `status: 'RUNNING' | 'STOPPED'`
- Type annotate all function parameters and returns
- Use `Record<string, string>` for key-value maps
- **Never use** `as any`, `@ts-ignore`, or type assertions
- Utility functions return `null` on error (not `undefined`)

### Naming Conventions
| Type | Convention | Examples |
|------|------------|----------|
| Components | PascalCase | `Dashboard.tsx`, `GceInventory.tsx` |
| Functions | camelCase | `checkOverlap`, `parseCidr` |
| Variables | camelCase | `selectedProjectId`, `currentView` |
| Types/Interfaces | PascalCase | `GcpProject`, `GcpVpc` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Files (services/utils) | camelCase | `api.service.ts`, `helpers.ts` |

### Component Patterns
```typescript
interface Props {
  projects: GcpProject[];
  selectedProjectId: string;
}

export const ComponentName: React.FC<Props> = ({ projects, selectedProjectId }) => {
  // Functional components only
  // Default export for App.tsx/index.tsx only
  // Named exports for reusable components
  // Define Props interface immediately before component
};
```

### Error Handling
```typescript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error("Error description:", error);
  return fallbackValue; // Never empty catch blocks
}
```

- Return user-friendly error strings, not raw errors
- Check API key configuration before external calls
- Log errors to console for debugging

### Styling (Tailwind CSS)
- Dark mode default: `bg-slate-900`, `text-white`, `text-slate-400`
- Cards: `bg-slate-800 rounded-xl border border-slate-700 p-6`
- **Never make visual/styling changes directly** - delegate to `frontend-ui-ux-engineer`

### State Management
- Local state via `useState<T>(initialValue)`
- No global state library - use props drilling
- Event handlers: `handleCommandNavigate`, `onProjectChange`

### Code Organization
- Components: UI + user interaction
- Services: External API calls
- Utils: Pure functions without side effects
- Types: Centralized in `types.ts`

## Go Backend Conventions

### Package Structure
```
go-backend/
├── cmd/main.go          # Entry point
├── internal/
│   ├── config/          # Configuration loading
│   ├── handlers/        # HTTP handlers (Echo)
│   ├── models/          # Data models
│   ├── repository/      # Data access layer
│   ├── services/        # Business logic
│   └── utils/           # Utilities (encryption, helpers)
```

### Go Naming & Style
- **Files**: snake_case (e.g., `credential_handler.go`)
- **Types/Interfaces**: PascalCase (e.g., `GcpService`, `Repository`)
- **Functions**: PascalCase for exported, camelCase for unexported
- **Variables/Constants**: camelCase (unexported), PascalCase (exported)
- **Error variables**: prefixed with `Err` (e.g., `ErrNotFound`)
- **HTTP handlers**: `HandlerName` pattern (e.g., `GetCredentialsHandler`)

### Go Error Handling
```go
// Return errors with context
if err := operation(); err != nil {
    return fmt.Errorf("failed to operation: %w", err)
}

// Use structured logging
zap.L().Error("operation failed", zap.Error(err), zap.String("key", value))

// Custom error types for business logic
var ErrNotFound = errors.New("resource not found")
```

### Go Patterns
- Repository pattern for data access (interface-based)
- Dependency injection via function parameters or structs
- Use `gorm.DB` in repository layer
- Handler receives services, not raw database connection

## Backend-Specific

### Node.js Backend
- Prisma ORM for database operations
- Zod for request validation
- AES-256-GCM encryption for credentials
- Soft delete via `isActive` flag
- Service layer handles business logic

### Go Backend
- GORM ORM for database operations
- Echo framework for HTTP routing
- AES-256-GCM encryption for credentials
- Soft delete via `is_active` field
- Repository pattern for data access
- Uber Zap for structured logging

## Key Technologies
- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS
- **Node.js Backend:** Express 4.21, Prisma 5.22, GCP APIs
- **Go Backend:** Echo framework, GORM, SQLite, GCP APIs
