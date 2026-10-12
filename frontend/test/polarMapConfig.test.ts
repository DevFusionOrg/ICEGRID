// @ts-ignore -- Node typings are not included in the frontend typecheck.
import assert from "node:assert/strict";
// @ts-ignore -- Node typings are not included in the frontend typecheck.
import { test } from "node:test";
import { POLAR_LATITUDE_LIMIT, POLAR_MAP_ATTRIBUTION, POLAR_REGION_DEFINITIONS, getMaxProjectedDistanceFromPole, isInPolarRegion, makePolarTileConfig, parsePolarLocation } from "../src/lib/polarMapConfig.ts";

test("parsePolarLocation preserves the existing coordinate parsing contract", () => {
  assert.deepEqual(parsePolarLocation({ latitude: -70, longitude: 45 }), [-70, 45]);
  assert.deepEqual(parsePolarLocation({ latitude: 90, longitude: 180 }), [90, 180]);
  assert.deepEqual(parsePolarLocation({ latitude: -90, longitude: -180 }), [-90, -180]);
  assert.deepEqual(parsePolarLocation("-51.25, 125.5"), [-51.25, 125.5]);
  assert.deepEqual(parsePolarLocation(" 70 , -30 "), [70, -30]);
  assert.equal(parsePolarLocation(""), null);
  assert.equal(parsePolarLocation("   "), null);
  assert.equal(parsePolarLocation("abc"), null);
  assert.equal(parsePolarLocation("12.3"), null);
  assert.equal(parsePolarLocation("12.3, 181"), null);
  assert.equal(parsePolarLocation("91, 10"), null);
  assert.equal(parsePolarLocation("-91, 10"), null);
  assert.equal(parsePolarLocation("10, -181"), null);
  assert.equal(parsePolarLocation(null), null);
  assert.equal(parsePolarLocation(undefined as never), null);
  assert.equal(parsePolarLocation({ latitude: Number.NaN, longitude: 0 }), null);
  assert.equal(parsePolarLocation({ latitude: 0, longitude: Number.NaN }), null);
});

test("isInPolarRegion uses the shared 60-degree cutoff consistently", () => {
  assert.equal(isInPolarRegion([-70, 15], "antarctic"), true);
  assert.equal(isInPolarRegion([70, -15], "arctic"), true);
  assert.equal(isInPolarRegion([70, -15], "antarctic"), false);
  assert.equal(isInPolarRegion([-70, 15], "arctic"), false);
  assert.equal(isInPolarRegion([-POLAR_LATITUDE_LIMIT, 0], "antarctic"), true);
  assert.equal(isInPolarRegion([POLAR_LATITUDE_LIMIT, 0], "arctic"), true);
  assert.equal(isInPolarRegion([-65, 0], "antarctic"), true);
  assert.equal(isInPolarRegion([65, 0], "arctic"), true);
  assert.equal(isInPolarRegion([-59.999, 0], "antarctic"), false);
  assert.equal(isInPolarRegion([59.999, 0], "arctic"), false);
  assert.equal(isInPolarRegion([-90, 0], "antarctic"), true);
  assert.equal(isInPolarRegion([90, 0], "arctic"), true);
  assert.equal(isInPolarRegion([Number.NaN, 0], "arctic"), false);
  assert.equal(isInPolarRegion({ latitude: Number.POSITIVE_INFINITY, longitude: 0 }, "arctic"), false);
  assert.equal(isInPolarRegion({ latitude: 0, longitude: 200 }, "arctic"), false);
});

test("polar region definitions match NASA GIBS metadata and shared config", () => {
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.epsg, "EPSG:3031");
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.epsg, "EPSG:3413");
  assert.deepEqual(POLAR_REGION_DEFINITIONS.antarctic.poleCenter, [-90, 0]);
  assert.deepEqual(POLAR_REGION_DEFINITIONS.arctic.poleCenter, [90, 0]);
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.proj4, "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs");
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.proj4, "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs");
  assert.deepEqual(POLAR_REGION_DEFINITIONS.antarctic.gridOrigin, [-4194304, 4194304]);
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.tileSize, 512);
  assert.deepEqual(Array.from(POLAR_REGION_DEFINITIONS.antarctic.resolutions), [8192, 4096, 2048, 1024, 512]);
  assert.deepEqual(Array.from(POLAR_REGION_DEFINITIONS.arctic.resolutions), [8192, 4096, 2048, 1024, 512]);
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.mimeType, "image/jpeg");
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.mimeType, "image/jpeg");
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.format, "jpeg");
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.format, "jpeg");
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.maxNativeZoom, 4);
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.maxNativeZoom, 4);
  assert.match(POLAR_MAP_ATTRIBUTION, /NASA Global Imagery Browse Services/);
  assert.equal(
    POLAR_REGION_DEFINITIONS.antarctic.tileUrlTemplate,
    "https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/BlueMarble_NextGeneration/default/{matrixSet}/{z}/{y}/{x}.{format}",
  );
  assert.equal(
    POLAR_REGION_DEFINITIONS.arctic.tileUrlTemplate,
    "https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/BlueMarble_NextGeneration/default/{matrixSet}/{z}/{y}/{x}.{format}",
  );
});

test("invalid matrix and image-format environment settings fall back to safe defaults", () => {
  const invalidMatrix = makePolarTileConfig("antarctic", {
    VITE_POLAR_MAP_MATRIX_SET: "250M",
  });
  assert.equal(invalidMatrix.matrixSet, "500m");
  assert.equal(invalidMatrix.resolutions.length, 5);

  const invalidMimeType = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_MIME_TYPE: "image/webp",
  });
  assert.equal(invalidMimeType.mimeType, "image/jpeg");
  assert.equal(invalidMimeType.format, "jpeg");

  const invalidFormat = makePolarTileConfig("antarctic", {
    VITE_POLAR_MAP_FORMAT: "jpg",
  });
  assert.equal(invalidFormat.mimeType, "image/jpeg");
  assert.equal(invalidFormat.format, "jpeg");

  const mismatchedFormats = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_MIME_TYPE: "image/png",
    VITE_POLAR_MAP_FORMAT: "jpeg",
  });
  assert.equal(mismatchedFormats.mimeType, "image/jpeg");
  assert.equal(mismatchedFormats.format, "jpeg");
});

test("Blue Marble always uses JPEG regardless of valid PNG overrides", () => {
  for (const region of ["antarctic", "arctic"] as const) {
    const config = makePolarTileConfig(region, {
      VITE_POLAR_MAP_LAYER: "BlueMarble_NextGeneration",
      VITE_POLAR_MAP_MIME_TYPE: "image/png",
      VITE_POLAR_MAP_FORMAT: "png",
    });
    const tileUrl = config.tileUrlTemplate
      .replace("{matrixSet}", config.matrixSet)
      .replace("{format}", config.format);

    assert.equal(config.mimeType, "image/jpeg");
    assert.equal(config.format, "jpeg");
    assert.match(tileUrl, /\/default\/500m\/\{z\}\/\{y\}\/\{x\}\.jpeg$/);
  }
});

test("PNG overrides are retained only for a layer with a supported GIBS PNG resource", () => {
  const supportedPngLayer = makePolarTileConfig("antarctic", {
    VITE_POLAR_MAP_LAYER: "VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance",
    VITE_POLAR_MAP_MIME_TYPE: "image/png",
    VITE_POLAR_MAP_FORMAT: "png",
  });
  assert.equal(supportedPngLayer.mimeType, "image/png");
  assert.equal(supportedPngLayer.format, "png");
  assert.match(
    supportedPngLayer.tileUrlTemplate.replace("{format}", supportedPngLayer.format),
    /\/default\/\{matrixSet\}\/\{z\}\/\{y\}\/\{x\}\.png$/,
  );

  const unsupportedPngLayer = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_LAYER: "Unknown_Layer",
    VITE_POLAR_MAP_MIME_TYPE: "image/png",
    VITE_POLAR_MAP_FORMAT: "png",
  });
  assert.equal(unsupportedPngLayer.mimeType, "image/jpeg");
  assert.equal(unsupportedPngLayer.format, "jpeg");
});

test("native zoom falls back by matrix set and clamps to available resolutions", () => {
  for (const invalid of [undefined, "", "not-a-number", "Infinity"]) {
    const config = makePolarTileConfig("antarctic", {
      VITE_POLAR_MAP_MATRIX_SET: "250m",
      VITE_POLAR_MAP_MAX_NATIVE_ZOOM: invalid,
    });
    assert.equal(config.maxNativeZoom, 5);
  }

  const defaultGridClamp = makePolarTileConfig("antarctic", {
    VITE_POLAR_MAP_MAX_NATIVE_ZOOM: "999",
  });
  assert.equal(defaultGridClamp.maxNativeZoom, defaultGridClamp.resolutions.length - 1);

  const finerGridClamp = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_MATRIX_SET: "250m",
    VITE_POLAR_MAP_MAX_NATIVE_ZOOM: "999",
  });
  assert.equal(finerGridClamp.maxNativeZoom, finerGridClamp.resolutions.length - 1);

  const negativeZoom = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_MAX_NATIVE_ZOOM: "-3",
  });
  assert.equal(negativeZoom.maxNativeZoom, 0);

  const decimalZoom = makePolarTileConfig("arctic", {
    VITE_POLAR_MAP_MAX_NATIVE_ZOOM: "3.8",
  });
  assert.equal(decimalZoom.maxNativeZoom, 3);
});

test("projected-distance helper is positive and finite for each region", () => {
  const antarcticDistance = getMaxProjectedDistanceFromPole("antarctic");
  const arcticDistance = getMaxProjectedDistanceFromPole("arctic");

  assert.ok(Number.isFinite(antarcticDistance));
  assert.ok(Number.isFinite(arcticDistance));
  assert.ok(antarcticDistance > 0);
  assert.ok(arcticDistance > 0);
  assert.ok(antarcticDistance > 1000000);
  assert.ok(arcticDistance > 1000000);
});
