// @ts-ignore -- Node typings are not included in the frontend typecheck.
import assert from "node:assert/strict";
// @ts-ignore -- Node typings are not included in the frontend typecheck.
import { test } from "node:test";
import { POLAR_LATITUDE_LIMIT, POLAR_MAP_ATTRIBUTION, POLAR_REGION_DEFINITIONS, getMaxProjectedDistanceFromPole, isInPolarRegion, parsePolarLocation } from "../src/lib/polarMapConfig.ts";

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
  assert.equal(POLAR_REGION_DEFINITIONS.antarctic.maxNativeZoom, 4);
  assert.equal(POLAR_REGION_DEFINITIONS.arctic.maxNativeZoom, 4);
  assert.match(POLAR_MAP_ATTRIBUTION, /NASA Global Imagery Browse Services/);
  assert.match(POLAR_REGION_DEFINITIONS.antarctic.tileUrlTemplate, /BlueMarble_NextGeneration\/default\/\{time\}\/\{matrixSet\}\/\{z\}\/\{y\}\/\{x\}\.\{format\}$/);
  assert.match(POLAR_REGION_DEFINITIONS.arctic.tileUrlTemplate, /BlueMarble_NextGeneration\/default\/\{time\}\/\{matrixSet\}\/\{z\}\/\{y\}\/\{x\}\.\{format\}$/);
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
