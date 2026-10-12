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

const MATRIX_SETS = ["500m", "250m"] as const;
const MIME_TYPES = ["image/jpeg", "image/png"] as const;
const FORMATS = ["jpeg", "png"] as const;
const PNG_TILE_LAYERS = ["VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance"] as const;

type PolarMapEnvironment = Readonly<Record<string, unknown>>;

function readEnvEnum<T extends readonly string[]>(
  environment: PolarMapEnvironment,
  name: string,
  supportedValues: T,
  fallback: T[number],
): T[number] {
  const value = environment[name];
  if (typeof value !== "string") return fallback;
  return supportedValues.find((supported) => supported === value) ?? fallback;
}

function readEnvNumber(environment: PolarMapEnvironment, name: string, fallback: number): number {
  const value = environment[name];
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const buildResolutionLevels = (startResolution: number, levelCount: number): readonly number[] =>
  Array.from({ length: levelCount }, (_, index) => startResolution / 2 ** index);

const readEnvString = (environment: PolarMapEnvironment, name: string, fallback: string) => {
  const value = environment[name];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
};

export function makePolarTileConfig(
  region: PolarRegion,
  environment: PolarMapEnvironment = viteEnv,
): PolarRegionDefinition {
  const polarBase = region === "antarctic" ? "https://gibs.earthdata.nasa.gov/wmts/epsg3031/best" : "https://gibs.earthdata.nasa.gov/wmts/epsg3413/best";
  const matrixSet = readEnvEnum(environment, "VITE_POLAR_MAP_MATRIX_SET", MATRIX_SETS, "500m");
  const configuredMimeType = readEnvEnum(environment, "VITE_POLAR_MAP_MIME_TYPE", MIME_TYPES, "image/jpeg");
  const configuredFormat = readEnvEnum(environment, "VITE_POLAR_MAP_FORMAT", FORMATS, "jpeg");
  const layer = readEnvString(environment, "VITE_POLAR_MAP_LAYER", "BlueMarble_NextGeneration");
  const isBlueMarbleNextGeneration = layer === "BlueMarble_NextGeneration";
  const hasMatchingImageFormat =
    (configuredMimeType === "image/jpeg" && configuredFormat === "jpeg") ||
    (configuredMimeType === "image/png" && configuredFormat === "png");
  const supportsConfiguredPng = PNG_TILE_LAYERS.some((supportedLayer) => supportedLayer === layer);
  const hasSupportedLayerFormat =
    configuredFormat === "jpeg" ||
    (configuredFormat === "png" && supportsConfiguredPng);
  const useJpeg = isBlueMarbleNextGeneration || !hasMatchingImageFormat || !hasSupportedLayerFormat;
  const mimeType = useJpeg ? "image/jpeg" : configuredMimeType;
  const format = useJpeg ? "jpeg" : configuredFormat;
  const levelCount = matrixSet === "250m" ? 6 : 5;
  const resolutions = buildResolutionLevels(8192, levelCount);
  const defaultMaxNativeZoom = matrixSet === "250m" ? 5 : 4;
  const maxNativeZoom = Math.min(
    Math.max(Math.floor(readEnvNumber(environment, "VITE_POLAR_MAP_MAX_NATIVE_ZOOM", defaultMaxNativeZoom)), 0),
    resolutions.length - 1,
  );
  const minZoom = readEnvNumber(environment, "VITE_POLAR_MAP_MIN_ZOOM", 0);
  const maxZoom = readEnvNumber(environment, "VITE_POLAR_MAP_MAX_ZOOM", 5);
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
    resolutions,
    maxNativeZoom,
    minZoom,
    maxZoom,
    tileUrlTemplate: `${polarBase}/${layer}/default/{matrixSet}/{z}/{y}/{x}.{format}`,
  }
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
