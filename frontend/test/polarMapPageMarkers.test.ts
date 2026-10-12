// @ts-ignore -- Node typings are not included in the frontend typecheck.
import assert from "node:assert/strict";
// @ts-ignore -- Node typings are not included in the frontend typecheck.
import { test } from "node:test";
import type { CargoItem, EmergencyAlert, LocationPoint, Personnel } from "../src/lib/api.ts";
import {
  ALERT_SEVERITY_COLORS,
  CARGO_STATUS_COLORS,
  PERSONNEL_STATUS_COLORS,
  createCargoPolarMarkers,
  createEmergencyPolarMarkers,
  createPersonnelPolarMarkers,
} from "../src/lib/polarMapPageMarkers.ts";

const locationPoint = (latitude: number, longitude: number): LocationPoint => ({
  id: "location-id",
  latitude,
  longitude,
  observedAt: "2025-01-01T00:00:00.000Z",
  accuracyMeters: null,
  altitudeMeters: null,
  source: "GPS",
  eventId: null,
  expeditionId: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
});

test("cargo markers retain status colors and prefer structured coordinates", () => {
  const statuses = ["PLANNED", "IN_TRANSIT", "AT_DESTINATION", "RECEIVED", "LOST"] as const;
  const cargo = statuses.map((status, index): CargoItem => ({
    id: `cargo-${index}`,
    expeditionId: "expedition-id",
    trackingCode: `TRACK-${index}`,
    name: `Cargo ${index}`,
    location: "-70, 30",
    currentLocation: locationPoint(-75, 20),
    status,
    updatedAt: "2025-01-01T00:00:00.000Z",
  }));

  const markers = createCargoPolarMarkers(cargo);

  assert.deepEqual(markers.map(({ color }) => color), statuses.map((status) => CARGO_STATUS_COLORS[status]));
  assert.deepEqual(markers[0], {
    id: "cargo-0",
    location: locationPoint(-75, 20),
    label: "Cargo 0",
    detail: "TRACK-0 · PLANNED",
    color: "#64748b",
  });
});

test("personnel markers retain status colors and legacy location fallback", () => {
  const statuses = ["ASSIGNED", "ON_SITE", "RETURNED", "INACTIVE"] as const;
  const personnel = statuses.map((status, index): Personnel => ({
    id: `person-${index}`,
    expeditionId: "expedition-id",
    firstName: "Polar",
    lastName: `Team ${index}`,
    role: "Researcher",
    status,
    lastKnownLocation: "-72, 14",
  }));

  const markers = createPersonnelPolarMarkers(personnel);

  assert.deepEqual(markers.map(({ color }) => color), statuses.map((status) => PERSONNEL_STATUS_COLORS[status]));
  assert.deepEqual(markers[0], {
    id: "person-0",
    location: "-72, 14",
    label: "Polar Team 0",
    detail: "Researcher · ASSIGNED",
    color: "#0284c7",
  });
});

test("emergency markers retain severity colors, alert details, and emergency styling", () => {
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const alerts = severities.map((severity, index): EmergencyAlert => ({
    id: `alert-${index}`,
    expeditionId: "expedition-id",
    title: `Alert ${index}`,
    message: "Assistance requested",
    severity,
    status: "OPEN",
    location: null,
    currentLocation: locationPoint(-80, 45),
    createdAt: "2025-01-01T00:00:00.000Z",
    resolvedAt: null,
  }));

  const markers = createEmergencyPolarMarkers(alerts);

  assert.deepEqual(markers.map(({ color }) => color), severities.map((severity) => ALERT_SEVERITY_COLORS[severity]));
  assert.deepEqual(markers[3], {
    id: "alert-3",
    location: locationPoint(-80, 45),
    label: "Alert 3",
    detail: "Assistance requested · CRITICAL",
    color: "#dc2626",
    kind: "emergency",
  });
});
