# NCPOR Polar Expedition Logistics

Phase 1 scaffold for the National Centre for Polar and Ocean Research (NCPOR) expedition logistics platform. The platform will provide a shared operational view for planning polar expeditions, coordinating transport and field teams, and tracking cargo and mission readiness.

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, and shadcn-compatible component configuration
- **Backend:** Node.js, Express, TypeScript, Prisma, and PostgreSQL
- **Infrastructure:** Docker Compose for local PostgreSQL development

## Getting started

1. Copy the environment examples:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item frontend/.env.example frontend/.env
   Copy-Item backend/.env.example backend/.env
   ```

2. Install workspace dependencies:

   ```powershell
   npm install
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose up -d postgres
   ```

4. Generate the Prisma client and start both applications:

   ```powershell
   npm run prisma:generate --workspace backend
   npm run dev
   ```

The frontend runs at `http://localhost:5173`, and the backend health check is available at `http://localhost:4000/api/health`.
