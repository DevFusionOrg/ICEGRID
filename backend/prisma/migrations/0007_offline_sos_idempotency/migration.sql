ALTER TABLE "EmergencyAlert" ADD COLUMN "operationId" TEXT;
CREATE UNIQUE INDEX "EmergencyAlert_operationId_key" ON "EmergencyAlert"("operationId");