import proj4 from "proj4";
import type { LocationPoint } from "./api";

export type PolarRegion = "antarctic" | "arctic";
export type PolarCoordinate = readonly [number, number];
export type MapLocation = Pick<LocationPoint, "latitude" | "longitude"> | string | null;

export const POLAR_LATITUDE_LIMIT = 60 as const;
export const POLAR_MAP_ATTRIBUTION = "Imagery: NASA Global Imagery Browse Services (GIBS), part of NASA ESDIS" as const;

export type PolarRegionDefinition = {
  epsg: `EPSG:${number}`;
  proj4: string;
  poleCenter: PolarCoordinate;
  label: string;
  baseUrl: string;
  layer: string;
  matrixSet: "500m" | "250m";
  mimeType: "image/jpeg" | "image/png";
  format: "jpeg" | "png";
  tileSize: number;
  gridOrigin: PolarCoordinate;
  resolutions: readonly number[];
  maxNativeZoom: number;
  minZoom: number;
  maxZoom: number;
  tileUrlTemplate: string;
};

const viteEnv = typeof import.meta !== "undefined" && "env" in import.meta ? import.meta.env : {};

const getEnvNumber = (name: string, fallback: number) => {
  const value = (viteEnv as Record<string, unknown>)[name];
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
};

const buildResolutionLevels = (startResolution: number, levelCount: number): readonly number[] =>
  Array.from({ length: levelCount }, (_, index) => startResolution / 2 ** index);

const readEnvString = (name: string, fallback: string) => {
  const value = (viteEnv as Record<string, string | undefined>)[name];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
};

const makePolarTileConfig = (region: PolarRegion): PolarRegionDefinition => {
  const polarBase = region === "antarctic" ? "https://gibs.earthdata.nasa.gov/wmts/epsg3031/best" : "https://gibs.earthdata.nasa.gov/wmts/epsg3413/best";
  const matrixSet = (readEnvString("VITE_POLAR_MAP_MATRIX_SET", "500m") as "500m" | "250m") || "500m";
  const mimeType = (readEnvString("VITE_POLAR_MAP_MIME_TYPE", "image/jpeg") as "image/jpeg" | "image/png") || "image/jpeg";
  const format = (readEnvString("VITE_POLAR_MAP_FORMAT", "jpeg") as "jpeg" | "png") || "jpeg";
  const layer = readEnvString("VITE_POLAR_MAP_LAYER", "BlueMarble_NextGeneration");
  const maxNativeZoomSetting = (viteEnv as Record<string, unknown>).VITE_POLAR_MAP_MAX_NATIVE_ZOOM;
  const maxNativeZoom = typeof maxNativeZoomSetting === "string" && maxNativeZoomSetting.trim() !== "" && Number.isFinite(Number(maxNativeZoomSetting))
    ? Number(maxNativeZoomSetting)
    : matrixSet === "250m" ? 5 : 4;
  const minZoom = getEnvNumber("VITE_POLAR_MAP_MIN_ZOOM", 0);
  const maxZoom = getEnvNumber("VITE_POLAR_MAP_MAX_ZOOM", 5);
  return {
    epsg: region === "antarctic" ? "EPSG:3031" : "EPSG:3413",
    proj4: region === "antarctic"
      ? "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
      : "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs",
    poleCenter: region === "antarctic" ? [-90, 0] : [90, 0],
    label: region === "antarctic" ? "Antarctic · EPSG:3031" : "Arctic · EPSG:3413",
    baseUrl: polarBase,
    layer,
    matrixSet,
    mimeType,
    format,
    tileSize: 512,
    gridOrigin: [-4194304, 4194304],
    resolutions: buildResolutionLevels(8192, matrixSet === "250m" ? 6 : 5),
    maxNativeZoom,
    minZoom,
    maxZoom,
    tileUrlTemplate: `${polarBase}/${layer}/default/{matrixSet}/{z}/{y}/{x}.{format}`,
  };
};

export const POLAR_REGION_DEFINITIONS: Record<PolarRegion, PolarRegionDefinition> = {
  antarctic: makePolarTileConfig("antarctic"),
  arctic: makePolarTileConfig("arctic"),
};

export function parsePolarLocation(location: MapLocation): [number, number] | null {
  if (location && typeof location === "object") {
    const { latitude, longitude } = location;
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
      ? [latitude, longitude]
      : null;
  }

  const match = location?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const point: [number, number] = [Number(match[1]), Number(match[2])];
  return point[0] >= -90 && point[0] <= 90 && point[1] >= -180 && point[1] <= 180 ? point : null;
}

export function isInPolarRegion(
  point:
    | MapLocation
    | readonly [number, number]
    | { latitude: number; longitude: number }
    | null
    | undefined,
  region: PolarRegion,
): boolean {
  if (point == null) return false;

  let normalized: readonly [number, number] | null;

if (typeof point === "string") {
  normalized = parsePolarLocation(point);
} else if (
  "latitude" in point &&
  "longitude" in point
) {
  normalized = [point.latitude, point.longitude];
} else {
  normalized = [point[0], point[1]];
}

  if (
    !normalized ||
    !Number.isFinite(normalized[0]) ||
    !Number.isFinite(normalized[1])
  ) {
    return false;
  }

  const [latitude, longitude] = normalized;

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }

  if (region === "antarctic") {
    return latitude <= -POLAR_LATITUDE_LIMIT;
  }

  return latitude >= POLAR_LATITUDE_LIMIT;
}

export function getMaxProjectedDistanceFromPole(region: PolarRegion): number {
  const cutoffLatitude = region === "antarctic" ? -POLAR_LATITUDE_LIMIT : POLAR_LATITUDE_LIMIT;
  const projected = proj4("EPSG:4326", POLAR_REGION_DEFINITIONS[region].proj4, [0, cutoffLatitude]);
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Number.NaN;
  return Math.hypot(x, y);
}

export function getPolarRegionDefinition(region: PolarRegion): PolarRegionDefinition {
  return POLAR_REGION_DEFINITIONS[region];
}
