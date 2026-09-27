# ICEGRID — Integrated Polar Expedition Logistics & Asset Management System

ICEGRID is a centralized operational logistics platform built for the **National Centre for Polar and Ocean Research (NCPOR)**. It streamlines polar expedition planning, supply chain consignment tracking, inventory management, personnel movement accountability, and emergency response during Antarctic missions.

---

## ✨ Key Features

- **Expedition Planning & Command Dashboard**: Unified operational view for organizing polar missions, station assignments, and resource allocation.
- **Multimodal Supply Chain Tracking**: End-to-end tracking of cargo consignments across all transit stages: *NCPOR Goa → Departure Port → Cape Town Logistics Hub → Vessel/Air Transport → Antarctic Stations (Maitri & Bharati)*.
- **Smart Cargo & Inventory Management**: Item-level tracking with SKUs, priority levels, condition states, reorder thresholds, and support for hazardous/perishable scientific samples.
- **Personnel Accountability & Movement**: Live batch-wise rosters tracking personnel deployment status, field roles, and station assignments.
- **Compliance & Shipment Documentation**: Digitized cargo declarations, invoices, packing lists, biosecurity permits, and customs clearance manifests.
- **Real-Time Alerts & Incident Response**: Instant emergency alert broadcasting, severity tagging, and personnel headcount safety tracking.
- **Offline-First Synchronization**: Local client-side storage (IndexedDB) with automated FIFO queue resynchronization for field operations in remote polar regions.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS, shadcn-compatible UI components, Lucide Icons
- **State & Data:** Zustand, TanStack React Query
- **Mapping & GIS:** Leaflet, React-Leaflet (with Proj4 polar projections)

### Backend & Database
- **Runtime & API:** Node.js, Express, TypeScript
- **ORM & Database:** Prisma ORM with PostgreSQL
- **Real-Time:** Socket.IO for live location tracking and alert broadcasts
- **Authentication:** JWT authentication with Role-Based Access Control (RBAC: `ADMIN`, `COORDINATOR`, `LOGISTICS_OFFICER`, `FIELD_PERSONNEL`)

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Docker Desktop** (for running local PostgreSQL)

### 1. Clone & Set Up Environment Variables

Copy the environment variable templates for root, frontend, and backend:

**PowerShell (Windows):**
```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

**Bash (Linux / macOS):**
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Database & Run Migrations

Start the local PostgreSQL container, apply migrations, and seed initial development data:

```bash
# Start PostgreSQL database container
docker compose up -d postgres

# Generate Prisma client and apply database migrations
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend

# Seed default test users and sample data
npm run seed --workspace backend
```

### 4. Run Development Servers

Start both frontend and backend dev servers concurrently:

```bash
npm run dev
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:4000/api](http://localhost:4000/api) (Health check: `http://localhost:4000/api/health`)

---

## 🧪 Testing & Verification

Run type checking and automated test suites across all workspaces:

```bash
# Typecheck TypeScript files
npm run typecheck

# Run backend API & auth test suite (Vitest - 57 tests passing)
npm run test --workspace backend

# Run frontend offline sync test suite (13 tests passing)
npm run test --workspace frontend
```

---

## 🐳 Production Deployment

To launch production container builds (Nginx frontend on port `8080`, Express backend on port `4000`, PostgreSQL on port `5432`):

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Access the production frontend at [http://localhost:8080](http://localhost:8080).

---

## 📁 Repository Structure

```
ICEGRID/
├── backend/                 # Node.js Express API & Prisma ORM
│   ├── prisma/              # Database schema & migrations
│   ├── src/                 # REST endpoints, Auth & Socket.IO realtime server
│   └── vitest.config.ts     # Backend test runner configuration
├── frontend/                # React TypeScript SPA with Vite & Tailwind
│   ├── src/                 # Components, pages, GIS maps & offline Zustand stores
│   └── test/                # Frontend offline queue test scripts
├── docker-compose.yml       # Dev database compose config
├── docker-compose.prod.yml  # Multi-container production deployment config
└── package.json             # Monorepo scripts
```

---

## 🔒 Authentication & API Roles

Protected backend routes require a JWT bearer token (`Authorization: Bearer <token>`). The system enforces fine-grained Role-Based Access Control (RBAC):

- `ADMIN`: Full administrative control over user accounts and system configuration.
- `COORDINATOR`: Expedition planning, station assignments, and team management.
- `LOGISTICS_OFFICER`: Cargo tracking updates, inventory control, and transport manifests.
- `FIELD_PERSONNEL`: Standard field view, location reporting, and emergency alert creation.
