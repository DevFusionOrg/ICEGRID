# 🧊 ICEGRID — Integrated Polar Expedition Logistics & Asset Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

ICEGRID is a centralized operational logistics platform built for the **National Centre for Polar and Ocean Research (NCPOR)**. It streamlines polar expedition planning, supply chain consignment tracking, inventory management, personnel movement accountability, and emergency response during Antarctic missions.

<p align="center">
  <strong>NCPOR Goa → Departure Port → Cape Town Hub → Vessel/Air → Maitri & Bharati Antarctic Stations</strong>
</p>

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 📊 **Command Dashboard** | Unified operational view for organizing polar missions and resource allocation |
| 📦 **Cargo Tracking** | End-to-end multimodal supply chain tracking across all transit stages |
| 📋 **Inventory Management** | Item-level tracking with SKUs, priority levels, condition states, and reorder alerts |
| 👥 **Personnel Accountability** | Live deployment rosters, field roles, station assignments, and movement tracking |
| 🚨 **Emergency Response** | Real-time alert broadcasting with severity levels and personnel safety tracking |
| 📡 **Real-Time Updates** | Server-Sent Events (SSE) for live cargo, location, and emergency notifications |
| 📶 **Offline-First** | IndexedDB local storage with automated FIFO queue resync for remote field use |
| 🗺️ **Polar GIS Maps** | Leaflet with Proj4 polar projections for Antarctic station mapping |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · Vite · TypeScript · Tailwind CSS · Zustand · TanStack Query · Leaflet |
| **Backend API** | Node.js · Express · TypeScript · Hono (SSE gateway) |
| **Database** | Supabase PostgreSQL · Prisma ORM |
| **Realtime** | SSE (Server-Sent Events) via Hono |
| **Auth** | JWT with Role-Based Access Control (RBAC) |
| **Deployment** | Cloudflare Workers (backend) · Any static host (frontend) |

---

## ⚡ Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| **Node.js** | v18 or higher |
| **npm** | v9 or higher |
| **Supabase account** | Free tier — [supabase.com](https://supabase.com) |


---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/DevFusionOrg/ICEGRID.git
cd ICEGRID
```

### Step 2 — Install Dependencies

```bash
npm install
```

### Step 3 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → Sign in with GitHub
2. Click **New project**
3. Set a **name** (e.g. `ICEGRID`) and a **database password** → save this password
4. Pick the **region** closest to you → click **Create new project**
5. Wait ~1 minute for provisioning

### Step 4 — Get Your Database Connection Strings

In your Supabase dashboard:

1. Go to **Settings** (⚙️ gear icon) → **Database**
2. Scroll to **Connection string**
3. Copy the **Session pooler** URI (port `5432`) — this is your `DATABASE_URL`
4. Copy the **Direct connection** URI (port `5432`, starts with `db.xxx.supabase.co`) — this is your `DIRECT_URL`


### Step 5 — Configure Environment Variables

**Backend** — create `backend/.env`:

```env
# Supabase connection (replace YOUR_PROJECT_REF and YOUR_PASSWORD)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres

# Auth
JWT_SECRET=pick-any-long-random-string-at-least-32-characters
JWT_EXPIRES_IN=1d

# Server
PORT=8787
FRONTEND_URL=http://localhost:5173

```

**Frontend** — create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8787/api
```

> 💡 You can also copy the example files:
> ```bash
> cp backend/.env.example backend/.env
> cp frontend/.env.example frontend/.env
> ```
> Then edit `backend/.env` with your Supabase URLs.

### Step 6 — Set Up the Database

```bash
# Generate Prisma client
npm run prisma:generate --workspace backend

# Push schema tables to your Supabase database
npx prisma db push --schema=backend/prisma/schema.prisma

# Seed 4 demo user accounts
npm run seed --workspace backend
```

### Step 7 — Run the Project

```bash
# Start both frontend + backend at once
npm run dev
```

Or start them separately in two terminals:

```bash
# Terminal 1 — Backend API (port 8787)
npm run dev --workspace backend

# Terminal 2 — Frontend UI (port 5173)
npm run dev --workspace frontend
```

### Step 8 — Open in Browser

🌐 **Open [http://localhost:5173](http://localhost:5173)** and log in!

---

## 🔑 Demo Login Accounts

After seeding, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@ncpors.local` | `ChangeMe123!` |
| **Coordinator** | `coordinator@ncpors.local` | `ChangeMe123!` |
| **Field Personnel** | `field@ncpors.local` | `ChangeMe123!` |
| **Logistics Officer** | `logistics@ncpors.local` | `ChangeMe123!` |

> Password can be changed via the `SEED_PASSWORD` environment variable before seeding.

---

## 🧪 Testing

```bash
# TypeScript type-checking (frontend + backend)
npm run typecheck

# Run all 73 tests (60 backend + 13 frontend)
npm test --workspaces

# Backend tests only (Vitest)
npm test --workspace backend

# Frontend tests only
npm test --workspace frontend
```

---

## 🌐 Deploy to Production

### Backend → Cloudflare Workers

```bash
# 1. Login to Cloudflare (one-time)
npx wrangler login

# 2. Set production secrets (one-time)
npx wrangler secret put JWT_SECRET --cwd backend
npx wrangler secret put DATABASE_URL --cwd backend

# 3. Deploy
npx wrangler deploy --cwd backend
```

Your API will be live at: `https://ncpors-backend.<your-subdomain>.workers.dev`

### Frontend → Any Static Host

```bash
# Build production bundle
npm run build --workspace frontend
```

Output is in `frontend/dist/` — deploy to **Cloudflare Pages**, **Vercel**, **Netlify**, or any static host.

Set the environment variable on your hosting platform:
```
VITE_API_URL=https://ncpors-backend.<your-subdomain>.workers.dev/api
```

---

## 📁 Project Structure

```
ICEGRID/
├── backend/                          # Node.js API Server
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema (12 models, PostgreSQL)
│   │   ├── migrations/               # SQL migration history
│   │   └── seed.ts                   # Demo data seeder (4 users)
│   ├── src/
│   │   ├── app.ts                    # Express app — all CRUD routes
│   │   ├── server.ts                 # Local Node.js dev server (port 8787)
│   │   ├── index.ts                  # Cloudflare Worker entry (Hono gateway)
│   │   ├── realtime.ts               # SSE client registry + broadcast engine
│   │   ├── realtimeRoutes.ts         # Hono routes: /stream, /join, /leave
│   │   ├── api/
│   │   │   └── crud.ts              # REST CRUD: expeditions, personnel, cargo, inventory
│   │   ├── auth/
│   │   │   ├── jwt.ts               # JWT sign & verify
│   │   │   ├── middleware.ts         # requireAuth, requireRole, requirePermission
│   │   │   ├── roles.ts             # RBAC role → permission mappings
│   │   │   └── routes.ts            # Login, register, user provisioning
│   │   ├── db/
│   │   │   └── prisma.ts            # Prisma client singleton
│   │   └── modules/
│   │       ├── emergency/            # Alert creation, acknowledgment, resolution
│   │       └── locations/            # GPS location recording & history
│   ├── wrangler.jsonc                # Cloudflare Worker config
│   └── .env.example                  # ← Copy this to .env
│
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx     # Command dashboard overview
│   │   │   ├── PlanningPage.tsx      # Expedition planning
│   │   │   ├── CargoTrackingPage.tsx # Supply chain tracking
│   │   │   ├── InventoryPage.tsx     # Inventory management
│   │   │   ├── PersonnelPage.tsx     # Personnel accountability
│   │   │   ├── EmergencyPage.tsx     # Emergency alerts & response
│   │   │   └── ResourcePage.tsx      # Resource allocation
│   │   ├── lib/
│   │   │   ├── api.ts               # HTTP API client
│   │   │   ├── realtimeClient.ts    # SSE EventSource client
│   │   │   ├── offlineQueue.ts      # IndexedDB offline queue
│   │   │   └── offlineSync.ts       # Background sync worker
│   │   ├── components/              # Reusable UI components
│   │   └── stores/                  # Zustand state stores
│   ├── test/                         # Frontend test suite (13 tests)
│   └── .env.example                  # ← Copy this to .env
│
├── .gitignore
├── package.json                       # npm workspaces monorepo root
└── README.md                          # ← You are here
```

---

## 🔌 API Reference

All protected routes require: `Authorization: Bearer <jwt_token>`

### Authentication

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/auth/login` | Login → returns JWT token + user info | Public |
| `POST` | `/api/auth/register` | Self-register as `FIELD_PERSONNEL` | Public |
| `POST` | `/api/users/` | Admin-only: provision user with any role | Admin |

### Core Data (CRUD)

| Method | Route | Description |
|--------|-------|-------------|
| `GET / POST` | `/api/expeditions/` | List / create expeditions |
| `GET / PATCH / DELETE` | `/api/expeditions/:id` | Read / update / delete expedition |
| `GET / POST` | `/api/personnel/` | List / create personnel |
| `GET / POST` | `/api/cargo-items/` | List / create cargo items |
| `GET / POST` | `/api/inventory-items/` | List / create inventory items |
| `GET / POST` | `/api/alerts/` | List / create emergency alerts |
| `PATCH` | `/api/alerts/:id/resolve` | Resolve an alert |

### Real-Time (SSE)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/realtime/stream?token=<jwt>` | Open SSE event stream |
| `POST` | `/api/realtime/join` | Join expedition room: `{ clientId, expeditionId }` |
| `POST` | `/api/realtime/leave` | Leave expedition room: `{ clientId, expeditionId }` |

**SSE events your client will receive:**

| Event | When | Data |
|-------|------|------|
| `connect` | Connection established | `{ ok: true, clientId }` |
| `cargo.updated` | Cargo status changed | Cargo object |
| `location.updated` | GPS location recorded | Location object |
| `emergency.created` | New emergency alert | Alert (without location) |
| `alert:new` | New alert (Admin/Coordinator only) | Full alert with location |
| `ping` | Every 15 seconds | Heartbeat |

### Health Check

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Returns `{ status: "ok" }` |

---

## 🔒 Role-Based Access Control (RBAC)

| Role | What they can do |
|------|-----------------|
| `ADMIN` | Everything — manage users, all data, system configuration |
| `COORDINATOR` | Manage expeditions, personnel, cargo, view all alerts with location |
| `LOGISTICS_OFFICER` | Manage cargo & inventory, view locations, read expeditions |
| `FIELD_PERSONNEL` | Read expeditions, report own location, create emergency alerts |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and ensure tests pass: `npm run typecheck && npm test --workspaces`
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

---

## 📝 License

This project was built for the Smart India Hackathon (SIH) for NCPOR.
