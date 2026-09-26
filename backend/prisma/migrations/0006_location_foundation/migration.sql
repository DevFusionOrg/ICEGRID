CREATE TYPE "LocationSource" AS ENUM ('MANUAL', 'GPS', 'SYSTEM', 'IMPORT', 'SIMULATION');

CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "latitude" DECIMAL(11,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "accuracyMeters" DECIMAL(10,2),
    "altitudeMeters" DECIMAL(10,2),
    "source" "LocationSource" NOT NULL DEFAULT 'MANUAL',
    "eventId" TEXT,
    "expeditionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonnelLocationHistory" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonnelLocationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CargoLocationHistory" (
    "id" TEXT NOT NULL,
    "cargoItemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoLocationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyLocationHistory" (
    "id" TEXT NOT NULL,
    "emergencyAlertId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmergencyLocationHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Personnel" ADD COLUMN "currentLocationId" TEXT;
ALTER TABLE "CargoItem" ADD COLUMN "currentLocationId" TEXT;
ALTER TABLE "EmergencyAlert" ADD COLUMN "currentLocationId" TEXT;

CREATE UNIQUE INDEX "Location_eventId_key" ON "Location"("eventId");
CREATE INDEX "Location_expeditionId_observedAt_idx" ON "Location"("expeditionId", "observedAt");
CREATE INDEX "Location_observedAt_idx" ON "Location"("observedAt");
CREATE UNIQUE INDEX "Personnel_currentLocationId_key" ON "Personnel"("currentLocationId");
CREATE UNIQUE INDEX "CargoItem_currentLocationId_key" ON "CargoItem"("currentLocationId");
CREATE UNIQUE INDEX "EmergencyAlert_currentLocationId_key" ON "EmergencyAlert"("currentLocationId");

CREATE UNIQUE INDEX "PersonnelLocationHistory_personnelId_locationId_key" ON "PersonnelLocationHistory"("personnelId", "locationId");
CREATE INDEX "PersonnelLocationHistory_personnelId_createdAt_idx" ON "PersonnelLocationHistory"("personnelId", "createdAt");
CREATE UNIQUE INDEX "CargoLocationHistory_cargoItemId_locationId_key" ON "CargoLocationHistory"("cargoItemId", "locationId");
CREATE INDEX "CargoLocationHistory_cargoItemId_createdAt_idx" ON "CargoLocationHistory"("cargoItemId", "createdAt");
CREATE UNIQUE INDEX "EmergencyLocationHistory_emergencyAlertId_locationId_key" ON "EmergencyLocationHistory"("emergencyAlertId", "locationId");
CREATE INDEX "EmergencyLocationHistory_emergencyAlertId_createdAt_idx" ON "EmergencyLocationHistory"("emergencyAlertId", "createdAt");

ALTER TABLE "Location" ADD CONSTRAINT "Location_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_latitude_range_check" CHECK ("latitude" >= -90 AND "latitude" <= 90);
ALTER TABLE "Location" ADD CONSTRAINT "Location_longitude_range_check" CHECK ("longitude" >= -180 AND "longitude" <= 180);
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CargoItem" ADD CONSTRAINT "CargoItem_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonnelLocationHistory" ADD CONSTRAINT "PersonnelLocationHistory_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonnelLocationHistory" ADD CONSTRAINT "PersonnelLocationHistory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CargoLocationHistory" ADD CONSTRAINT "CargoLocationHistory_cargoItemId_fkey" FOREIGN KEY ("cargoItemId") REFERENCES "CargoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CargoLocationHistory" ADD CONSTRAINT "CargoLocationHistory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyLocationHistory" ADD CONSTRAINT "EmergencyLocationHistory_emergencyAlertId_fkey" FOREIGN KEY ("emergencyAlertId") REFERENCES "EmergencyAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyLocationHistory" ADD CONSTRAINT "EmergencyLocationHistory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;