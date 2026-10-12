import {
  getMaxProjectedDistanceFromPole,
  getPolarRegionDefinition,
  isInPolarRegion,
  parsePolarLocation,
} from "./polarMapConfig";
import type { MapLocation, PolarRegion } from "./polarMapConfig";

export type PolarMapMarker = {
  id: string;
  location: MapLocation;
  label: string;
  detail?: string;
  color: string;
  kind?: "location" | "emergency";
};

export type PlottedPolarMapMarker = PolarMapMarker & {
  position: [number, number];
};

export type TileLoadStatus = "unknown" | "available" | "unavailable";

export function getPolarInitialView(region: PolarRegion) {
  const definition = getPolarRegionDefinition(region);
  return {
    center: [definition.poleCenter[0], definition.poleCenter[1]] as [number, number],
    zoom: definition.minZoom,
    minZoom: definition.minZoom,
    maxZoom: definition.maxZoom,
  };
}

export function createTileLoadTracker() {
  let failures = 0;
  let successes = 0;

  return {
    beginLoading() {
      failures = 0;
      successes = 0;
    },
    tileLoaded() {
      successes += 1;
    },
    tileFailed() {
      failures += 1;
    },
    finishLoading(): TileLoadStatus {
      if (successes > 0) return "available";
      if (failures > 0) return "unavailable";
      return "unknown";
    },
  };
}

export function preparePolarMapMarkers(
  markers: readonly PolarMapMarker[],
  region: PolarRegion,
): PlottedPolarMapMarker[] {
  return markers.flatMap((marker) => {
    const position = parsePolarLocation(marker.location);
    return position && isInPolarRegion(position, region) ? [{ ...marker, position }] : [];
  });
}

export function getPolarTileUrl(region: PolarRegion): string {
  const config = getPolarRegionDefinition(region);
  return config.tileUrlTemplate.replace(/\{(matrixSet|format)\}/g, (_token, key: "matrixSet" | "format") => config[key]);
}

export function constrainPolarProjectedCenter(
  center: readonly [number, number],
  region: PolarRegion,
  viewportRadius = 0,
): [number, number] {
  const [x, y] = center;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const radius = Math.hypot(x, y);
  const safeViewportRadius = Number.isFinite(viewportRadius) ? Math.max(0, viewportRadius) : 0;
  const maxCenterRadius = Math.max(0, getMaxProjectedDistanceFromPole(region) - safeViewportRadius);
  if (radius === 0 || radius <= maxCenterRadius) return [x, y];
  return [(x / radius) * maxCenterRadius, (y / radius) * maxCenterRadius];
}
