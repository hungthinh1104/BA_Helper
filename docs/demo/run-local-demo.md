# BA Helper: Local Demo Runbook

This guide enables reviewers to rapidly spin up a reproducible demo of the BA Helper audit workflow on their local machine.

## Demo Approach
- **No external AI providers required.**
- **No cloning of real repositories required.**
- We will use an idempotent script to seed a realistic, synthetic "Booking Cancellation" analysis.
- This allows you to immediately test the Human Review Gate, the immutable snapshot, and the final audited markdown export without waiting for long-running parsers or LLM requests.

## Prerequisites
- Node.js (v20+)
- pnpm (v9+)
- Docker & Docker Compose (for PostgreSQL and Redis)

---

## Step-by-Step Setup

### 1. Start Infrastructure
Start the required PostgreSQL and Redis containers in the background:
```bash
docker compose up -d postgres redis
```

### 2. Environment Configuration
Copy the safe default environments. The `.env.example` files are pre-configured to use local databases and fake AI providers.
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Database & Seed Demo Data
Run the migrations to create the database schema, then run the deterministic demo seed script.
```bash
pnpm db:migrate
pnpm db:seed:demo
```
*Note: `db:seed:demo` is idempotent. It will safely clean up and recreate the `BA Helper Demo: Booking Cancellation` project every time it is run.*

### 5. Start the Application
You will need three terminal windows to run the stack:
```bash
# Terminal 1: Backend API
pnpm dev:api

# Terminal 2: Background Worker (Not strictly needed for the seed, but good practice)
pnpm dev:worker

# Terminal 3: Frontend Web App
pnpm dev:web
```

---

## 6. Accessing the UI

Open [http://localhost:3000/login](http://localhost:3000/login) in your browser.

Because we are running in `dev-single-user` mode (defined in `.env`), you will see a "Bypass Login" button. Click it to authenticate instantly as an Admin.

Navigate to the project dropdown and select the **BA Helper Demo: Booking Cancellation** project. You will see two pre-seeded analyses ready for review.

---

## Demo Acceptance Flow

For exactly what to click and review, proceed to the [Demo Acceptance Checklist](./demo-acceptance-checklist.md).
