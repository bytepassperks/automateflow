# AutomateFlow

A production-ready browser automation platform that lets users automate web tasks using AI-powered browser agents. Users can run pre-built automation templates or describe custom tasks in natural language, and an AI agent drives a real browser to complete them.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│    Redis     │
│  React/Vite  │◀────│  Express.js  │◀────│   BullMQ    │
│  Tailwind    │     │  Socket.IO   │     └──────┬──────┘
└─────────────┘     └──────┬───────┘            │
                           │                     │
                    ┌──────▼───────┐     ┌──────▼──────┐
                    │  PostgreSQL  │     │   Worker    │
                    │  (Database)  │     │  Python +   │
                    └──────────────┘     │  Playwright │
                                        │  + LLM APIs │
                                        └─────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, React Router v6 |
| Backend | Node.js 20, Express, Sequelize, Socket.IO, BullMQ |
| Worker | Python 3.11, Playwright, browser-use |
| Database | PostgreSQL 15 |
| Queue | Redis 7 + BullMQ |
| Storage | iDrive e2 (S3-compatible) |
| Email | AWS SES |
| LLM | Google AI Studio, Groq, Cerebras, OpenRouter, HuggingFace (free tier rotation) |

## Features

- **AI-Powered Browser Automation** - Describe tasks in natural language or use templates
- **5 Pre-Built Templates** - LinkedIn scraper, price monitor, form filler, screenshot generator, PDF invoice downloader
- **Live Browser Viewer** - Watch automation in real-time via screenshot slideshow
- **CAPTCHA/OTP Handoff** - Automatic detection with human handoff when needed
- **API Key Management** - Programmatic access with `af_live_` / `af_test_` keys
- **Webhook Support** - Get notified on job completion/failure
- **LLM Provider Rotation** - Automatic failover across 5 free LLM providers
- **Anti-Detection** - Randomized user agents, viewports, and stealth mode
- **Dark Mode UI** - Modern SaaS design inspired by Vercel/Linear

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for local dev)

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/bytepassperks/automateflow.git
cd automateflow
```

2. Create environment files:
```bash
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
cp frontend/.env.example frontend/.env
```

3. Edit `.env` files with your API keys (LLM providers, iDrive e2, AWS SES).

4. Start all services:
```bash
docker-compose up --build
```

5. Access the app:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

### Local Development

#### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your config
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

#### Worker
```bash
cd worker
cp .env.example .env
pip install -r requirements.txt
playwright install chromium
python -m src.worker
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Create automation job |
| GET | `/api/jobs` | List user's jobs (paginated) |
| GET | `/api/jobs/:id` | Get job detail |
| POST | `/api/jobs/:id/cancel` | Cancel a job |
| POST | `/api/jobs/:id/handoff-complete` | Signal CAPTCHA/OTP solved |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:slug` | Get template by slug |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Create new API key |
| GET | `/api/keys` | List user's keys (masked) |
| DELETE | `/api/keys/:id` | Revoke a key |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/worker` | Worker status callback |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## Environment Variables

See `backend/.env.example`, `worker/.env.example`, and `frontend/.env.example` for all required configuration.

### Key Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `REDIS_URL` | Backend/Worker | Redis connection string |
| `JWT_SECRET` | Backend | JWT signing secret |
| `WORKER_SECRET` | Backend/Worker | Shared secret for worker auth |
| `GOOGLE_AI_STUDIO_KEY` | Worker | Google AI Studio API key |
| `GROQ_API_KEY` | Worker | Groq API key |
| `IDRIVE_E2_*` | Backend/Worker | iDrive e2 storage credentials |
| `AWS_SES_*` | Backend | AWS SES email credentials |

## Deployment Guide

### Backend → Railway Pro
1. Connect GitHub repo to Railway
2. Set root directory to `/backend`
3. Add all environment variables
4. Deploy

### Worker → Railway Pro
1. Create new Railway service
2. Set root directory to `/worker`
3. Add all environment variables
4. Deploy

### Frontend → Vercel
1. Import GitHub repo to Vercel
2. Set root directory to `/frontend`
3. Set `VITE_API_URL` to deployed backend URL
4. Deploy

### Database → DigitalOcean Managed PostgreSQL
1. Create managed PostgreSQL cluster
2. Update `DATABASE_URL` in backend config

### Redis → Railway Pro
1. Add Redis plugin to Railway project
2. Use provided `REDIS_URL`

### Storage → iDrive e2
1. Create iDrive e2 account
2. Create bucket `automateflow-files`
3. Generate access keys
4. Update `IDRIVE_E2_*` variables

## Template Library

| Template | Slug | Description |
|----------|------|-------------|
| LinkedIn Profile Scraper | `linkedin-scraper` | Extract profile data from LinkedIn |
| Product Price Monitor | `price-monitor` | Monitor product prices against targets |
| Form Auto-Filler | `form-filler` | Automatically fill web forms |
| Screenshot Generator | `screenshot-generator` | Capture webpage screenshots |
| PDF Invoice Downloader | `pdf-invoice-downloader` | Download PDF invoices from portals |

## License

MIT
