export interface ReadinessChecklistItem {
  id: string;
  label: string;
  description: string;
  weight: number;
  passed: boolean;
  score: number;
}

export interface ExpeditionReadinessResult {
  score: number;
  status: "READY" | "IN_PROGRESS" | "ATTENTION_REQUIRED";
  summary: string;
  checklist: ReadinessChecklistItem[];
  metrics: {
    personnelCount: number;
    cargoCount: number;
    inventoryCount: number;
    openAlertsCount: number;
    criticalAlertsCount: number;
  };
}

export interface ExpeditionLike {
  id?: string;
  name?: string | null;
  code?: string | null;
  destination?: string | null;
  description?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  status?: string | null;
  coordinatorId?: string | null;
  coordinatorName?: string | null;
  leadScientistId?: string | null;
  leadScientist?: unknown | null;
  coordinator?: unknown | null;
  personnel?: unknown[] | null;
  cargoItems?: unknown[] | null;
  inventoryItems?: unknown[] | null;
  emergencyAlerts?: Array<{ severity: string; status: string }> | null;
  _count?: {
    personnel?: number;
    cargoItems?: number;
    inventoryItems?: number;
    emergencyAlerts?: number;
  };
}

/**
 * Calculates mission readiness percentage and detailed checklist breakdown.
 */
export function calculateExpeditionReadiness(expedition: ExpeditionLike): ExpeditionReadinessResult {
  const personnelCount =
    expedition._count?.personnel ??
    (Array.isArray(expedition.personnel) ? expedition.personnel.length : 0);

  const cargoCount =
    expedition._count?.cargoItems ??
    (Array.isArray(expedition.cargoItems) ? expedition.cargoItems.length : 0);

  const inventoryCount =
    expedition._count?.inventoryItems ??
    (Array.isArray(expedition.inventoryItems) ? expedition.inventoryItems.length : 0);

  const alerts = expedition.emergencyAlerts ?? [];
  const openAlerts = alerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED");
  const criticalAlerts = openAlerts.filter((a) => a.severity === "CRITICAL");
  const openAlertsCount = expedition._count?.emergencyAlerts ?? openAlerts.length;

  const checklist: ReadinessChecklistItem[] = [];

  // 1. Destination & Mission Scope (12 pts)
  const hasDestination = Boolean(expedition.destination && expedition.destination.trim().length > 0);
  const hasDesc = Boolean(expedition.description && expedition.description.trim().length >= 5);
  const destPassed = hasDestination && hasDesc;
  const destScore = (hasDestination ? 8 : 0) + (hasDesc ? 4 : 0);
  checklist.push({
    id: "destination_scope",
    label: "Destination & Mission Objectives",
    description: hasDestination
      ? `Target destination set to ${expedition.destination}`
      : "Target polar station or coordinates required",
    weight: 12,
    passed: destPassed,
    score: destScore,
  });

  // 2. Operating Schedule (15 pts)
  const hasStart = Boolean(expedition.startDate);
  const hasEnd = Boolean(expedition.endDate);
  const validDates = hasStart && hasEnd && new Date(expedition.endDate!) >= new Date(expedition.startDate!);
  const scheduleScore = validDates ? 15 : (hasStart || hasEnd ? 7 : 0);
  checklist.push({
    id: "schedule",
    label: "Operational Window & Schedule",
    description: validDates
      ? "Deployment window verified"
      : "Start and end dates required for mission timeline",
    weight: 15,
    passed: validDates,
    score: scheduleScore,
  });

  // 3. Coordinator Assigned (15 pts)
  const hasCoordinator = Boolean(
    (expedition.coordinatorId && expedition.coordinatorId.trim().length > 0) ||
    (expedition.coordinatorName && expedition.coordinatorName.trim().length > 0) ||
    expedition.coordinator
  );
  checklist.push({
    id: "coordinator",
    label: "Expedition Coordinator Assigned",
    description: hasCoordinator
      ? `Command coordinator assigned (${expedition.coordinatorName || "Assigned"})`
      : "Mission requires an assigned coordinator",
    weight: 15,
    passed: hasCoordinator,
    score: hasCoordinator ? 15 : 0,
  });

  // 4. Lead Scientist Appointed (18 pts)
  const hasLeadScientist = Boolean(
    (expedition.leadScientistId && expedition.leadScientistId.trim().length > 0) ||
    expedition.leadScientist
  );
  checklist.push({
    id: "lead_scientist",
    label: "Lead Scientist Appointed",
    description: hasLeadScientist
      ? "Scientific leadership designated"
      : "Expedition lead scientist pending appointment",
    weight: 18,
    passed: hasLeadScientist,
    score: hasLeadScientist ? 18 : 0,
  });

  // 5. Personnel Roster (20 pts)
  const hasMinPersonnel = personnelCount >= 1;
  let personnelScore = 0;
  if (personnelCount >= 5) {
    personnelScore = 20;
  } else if (personnelCount >= 1) {
    personnelScore = 12 + personnelCount * 1.5;
  }
  checklist.push({
    id: "personnel_roster",
    label: "Personnel Crew Assigned",
    description: hasMinPersonnel
      ? `${personnelCount} crew personnel designated`
      : "At least 1 personnel member must be rostered",
    weight: 20,
    passed: hasMinPersonnel,
    score: Math.min(20, Math.round(personnelScore)),
  });

  // 6. Logistics Cargo & Equipment (20 pts)
  const hasMinCargo = cargoCount >= 1 || inventoryCount >= 1;
  let cargoScore = 0;
  if (cargoCount >= 5) {
    cargoScore = 20;
  } else if (cargoCount >= 1 || inventoryCount >= 1) {
    cargoScore = 12 + Math.min(8, cargoCount * 1.5);
  }
  checklist.push({
    id: "logistics_cargo",
    label: "Cargo & Equipment Manifest",
    description: hasMinCargo
      ? `${cargoCount} cargo items manifest registered`
      : "Logistics equipment and cargo items required",
    weight: 20,
    passed: hasMinCargo,
    score: Math.min(20, Math.round(cargoScore)),
  });

  // Base raw score
  let totalScore = checklist.reduce((sum, item) => sum + item.score, 0);

  // Risk & Emergency deduction
  if (criticalAlerts.length > 0) {
    totalScore -= 25;
  } else if (openAlerts.length > 0) {
    totalScore -= 10;
  }

  const score = Math.max(0, Math.min(100, Math.round(totalScore)));

  let status: "READY" | "IN_PROGRESS" | "ATTENTION_REQUIRED" = "IN_PROGRESS";
  let summary = "Expedition is in preparation phase.";

  if (criticalAlerts.length > 0) {
    status = "ATTENTION_REQUIRED";
    summary = "Critical emergency alerts active; mission readiness blocked.";
  } else if (score >= 80) {
    status = "READY";
    summary = "Mission readiness is operational. All primary requirements satisfied.";
  } else if (score < 50) {
    status = "ATTENTION_REQUIRED";
    summary = "Essential mission criteria missing (leadership, personnel, or schedule).";
  }

  return {
    score,
    status,
    summary,
    checklist,
    metrics: {
      personnelCount,
      cargoCount,
      inventoryCount,
      openAlertsCount,
      criticalAlertsCount: criticalAlerts.length,
    },
  };
}

/**
 * Validates expedition code format and uniqueness.
 */
export function validateExpeditionCode(
  code: string,
  existingCodes: Array<{ id: string; code: string }>,
  currentExpeditionId?: string,
): { valid: boolean; error?: string } {
  const trimmed = (code || "").trim().toUpperCase();

  if (!trimmed) {
    return { valid: false, error: "Expedition code is required." };
  }

  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, error: "Expedition code must be between 3 and 30 characters." };
  }

  const pattern = /^[A-Z0-9]+(-[A-Z0-9]+)+$/;
  if (!pattern.test(trimmed)) {
    return {
      valid: false,
      error: "Expedition code must follow format: [PREFIX]-[NUMBER] (e.g., IEA-46, EXP-2026-01).",
    };
  }

  const conflict = existingCodes.find(
    (item) => item.code.toUpperCase() === trimmed && item.id !== currentExpeditionId,
  );

  if (conflict) {
    return { valid: false, error: `Expedition code "${trimmed}" is already in use.` };
  }

  return { valid: true };
}

/**
 * Generates the next recommended expedition code based on existing codes.
 */
export function generateExpeditionCode(
  existingCodes: string[],
  prefix = "IEA",
): string {
  const normalizedPrefix = prefix.trim().toUpperCase() || "IEA";
  const regex = new RegExp(`^${normalizedPrefix}-(\\d+)$`, "i");

  let highestNum = 0;
  let padLength = 0;

  for (const c of existingCodes) {
    const match = c.trim().match(regex);
    if (match) {
      const numStr = match[1];
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > highestNum) {
        highestNum = num;
        padLength = numStr.length;
      }
    }
  }

  if (highestNum > 0) {
    const nextStr = String(highestNum + 1);
    const padded = padLength > nextStr.length ? nextStr.padStart(padLength, "0") : nextStr;
    return `${normalizedPrefix}-${padded}`;
  }

  // If no existing codes with this prefix, start with standard Indian Antarctic Expedition sequence (IEA-46)
  if (normalizedPrefix === "IEA") {
    return "IEA-46";
  }

  return `${normalizedPrefix}-01`;
}
