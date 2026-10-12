import type { AlertSeverity, CargoItem, CargoStatus, EmergencyAlert, Personnel } from "./api";
import type { PolarMapMarker } from "./polarMapPresentation";

export const CARGO_STATUS_COLORS: Record<CargoStatus, string> = {
  PLANNED: "#64748b",
  IN_TRANSIT: "#0284c7",
  AT_DESTINATION: "#7c3aed",
  RECEIVED: "#16a34a",
  LOST: "#dc2626",
};

export const PERSONNEL_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "#0284c7",
  ON_SITE: "#16a34a",
  RETURNED: "#64748b",
  INACTIVE: "#dc2626",
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  LOW: "#0284c7",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export function createCargoPolarMarkers(cargo: readonly CargoItem[]): PolarMapMarker[] {
  return cargo.map((item) => ({
    id: item.id,
    location: item.currentLocation ?? item.location,
    label: item.name,
    detail: `${item.trackingCode} · ${item.status}`,
    color: CARGO_STATUS_COLORS[item.status],
  }));
}

export function createPersonnelPolarMarkers(personnel: readonly Personnel[]): PolarMapMarker[] {
  return personnel.map((person) => ({
    id: person.id,
    location: person.currentLocation ?? person.lastKnownLocation,
    label: `${person.firstName} ${person.lastName}`,
    detail: `${person.role} · ${person.status}`,
    color: PERSONNEL_STATUS_COLORS[person.status] ?? "#0284c7",
  }));
}

export function createEmergencyPolarMarkers(alerts: readonly EmergencyAlert[]): PolarMapMarker[] {
  return alerts.map((alert) => ({
    id: alert.id,
    location: alert.currentLocation ?? alert.location,
    label: alert.title,
    detail: `${alert.message} · ${alert.severity}`,
    color: ALERT_SEVERITY_COLORS[alert.severity],
    kind: "emergency",
  }));
}
