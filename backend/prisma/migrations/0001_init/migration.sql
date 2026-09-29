CREATE SCHEMA IF NOT EXISTS "public";
-- CreateSchema
CREATE TYPE "ExpeditionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TYPE "PersonnelRole" AS ENUM ('LEAD', 'SCIENTIST', 'LOGISTICS', 'MEDICAL', 'ENGINEER', 'MEMBER');

CREATE TYPE "PersonnelStatus" AS ENUM ('ASSIGNED', 'ON_SITE', 'RETURNED', 'INACTIVE');

CREATE TYPE "CargoPriority" AS ENUM ('LOW', 'STANDARD', 'HIGH', 'CRITICAL');

CREATE TYPE "CargoStatus" AS ENUM ('PLANNED', 'IN_TRANSIT', 'AT_DESTINATION', 'RECEIVED', 'LOST');

CREATE TYPE "InventoryCondition" AS ENUM ('NEW', 'GOOD', 'NEEDS_REPAIR', 'DAMAGED', 'RETIRED');

CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "destination" TEXT,
    "description" TEXT,
    "status" "ExpeditionStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "leadScientistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "organization" TEXT,
    "role" "PersonnelRole" NOT NULL DEFAULT 'MEMBER',
    "status" "PersonnelStatus" NOT NULL DEFAULT 'ASSIGNED',
    "emergencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CargoItem" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(10,2),
    "priority" "CargoPriority" NOT NULL DEFAULT 'STANDARD',
    "status" "CargoStatus" NOT NULL DEFAULT 'PLANNED',
    "origin" TEXT,
    "destination" TEXT,
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT,
    "cargoItemId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "location" TEXT,
    "condition" "InventoryCondition" NOT NULL DEFAULT 'GOOD',
    "lastCountedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "acknowledgedById" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "location" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Expedition_code_key" ON "Expedition"("code");

CREATE INDEX "Personnel_expeditionId_idx" ON "Personnel"("expeditionId");

CREATE INDEX "Personnel_status_idx" ON "Personnel"("status");

CREATE UNIQUE INDEX "CargoItem_trackingCode_key" ON "CargoItem"("trackingCode");

CREATE INDEX "CargoItem_expeditionId_idx" ON "CargoItem"("expeditionId");

CREATE INDEX "CargoItem_status_idx" ON "CargoItem"("status");

CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

CREATE INDEX "InventoryItem_expeditionId_idx" ON "InventoryItem"("expeditionId");

CREATE INDEX "InventoryItem_cargoItemId_idx" ON "InventoryItem"("cargoItemId");

CREATE INDEX "EmergencyAlert_expeditionId_status_idx" ON "EmergencyAlert"("expeditionId", "status");

CREATE INDEX "EmergencyAlert_severity_idx" ON "EmergencyAlert"("severity");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_leadScientistId_fkey" FOREIGN KEY ("leadScientistId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CargoItem" ADD CONSTRAINT "CargoItem_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_cargoItemId_fkey" FOREIGN KEY ("cargoItemId") REFERENCES "CargoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

