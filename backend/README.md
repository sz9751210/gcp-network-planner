# Backend API

This is the backend API for GCP Network Planner. It handles service account credential storage and fetches data from Google Cloud.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or SQLite for development)

### Installation

```bash
cd backend
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/gcp_network_planner`)
- `ENCRYPTION_KEY`: 64-character hex string for encrypting credentials
- `PORT`: Server port (default: 3001)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup

### Using PostgreSQL (Production)

```bash
# Create database
createdb gcp_network_planner

# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### Using SQLite (Development)

Update `.env`:
```
DATABASE_URL="file:./dev.db"
```

Then run:
```bash
npm run prisma:migrate
npm run prisma:generate
```

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Credentials

- `POST /api/credentials` - Create service account
- `GET /api/credentials` - List all service accounts
- `GET /api/credentials/:id` - Get service account details
- `DELETE /api/credentials/:id` - Delete service account
- `POST /api/credentials/:id/test` - Test connection

### GCP Data

- `GET /api/gcp?serviceAccountId=:id` - Fetch GCP projects
- `GET /api/gcp/all-data?serviceAccountId=:id` - Fetch all project data
- `GET /api/gcp/:projectId/vpcs?serviceAccountId=:id` - Fetch VPCs
- `GET /api/gcp/:projectId/firewalls?serviceAccountId=:id` - Fetch firewall rules
- `GET /api/gcp/:projectId/instances?serviceAccountId=:id` - Fetch instances

## Security

- Service account credentials are encrypted using AES-256-GCM before storage
- Encryption key is derived using PBKDF2 with 100,000 iterations
- Credentials are never returned in plaintext to clients
- CORS is configured for specific origins
- Helmet.js provides security headers

## Database Schema

See `prisma/schema.prisma` for the complete database schema.

Key tables:
- `service_accounts`: Encrypted service account credentials
- `gcp_projects`: Project metadata
- `gcp_vpcs`: VPC network data
- `gcp_subnets`: Subnet information
- `gcp_vpc_peerings`: VPC peering connections
- `gcp_routes`: Route information
- `gcp_instances`: Compute instances
- `gcp_firewall_rules`: Firewall rules
