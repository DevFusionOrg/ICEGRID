// @ts-ignore -- Node typings are not included in the frontend typecheck.
import assert from "node:assert/strict";
// @ts-ignore -- Node typings are not included in the frontend typecheck.
import { test } from "node:test";
import {
  createTileLoadTracker,
  getPolarInitialView,
  getPolarTileUrl,
  preparePolarMapMarkers,
  constrainPolarProjectedCenter,
} from "../src/lib/polarMapPresentation.ts";
import {
  POLAR_REGION_DEFINITIONS,
  getMaxProjectedDistanceFromPole,
} from "../src/lib/polarMapConfig.ts";

test("selects the matching polar GIBS endpoint and tile grid", () => {
  assert.match(
    getPolarTileUrl("antarctic"),
    /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3031\/best\/BlueMarble_NextGeneration\/default\/2024-01-01\/500m\/\{z\}\/\{y\}\/\{x\}\.jpg$/,
  );
  assert.match(
    getPolarTileUrl("arctic"),
    /^https:\/\/gibs\.earthdata.nasa.gov\/wmts\/epsg3413\/best\/BlueMarble_NextGeneration\/default\/2024-01-01\/500m\/\{z\}\/\{y\}\/\{x\}\.jpg$/,
  );
  for (const region of ["antarctic", "arctic"] as const) {
    const config = POLAR_REGION_DEFINITIONS[region];
    assert.equal(config.tileSize, 512);
    assert.equal(config.maxNativeZoom, config.resolutions.length - 1);
    assert.equal(config.maxZoom, config.maxNativeZoom + 1);
  }
});

test("starts each polar region at its configured pole with a native-grid overview zoom", () => {
  assert.deepEqual(getPolarInitialView("antarctic"), {
    center: [-90, 0],
    zoom: 0,
    minZoom: 0,
    maxZoom: 5,
  });
  assert.deepEqual(getPolarInitialView("arctic"), {
    center: [90, 0],
    zoom: 0,
    minZoom: 0,
    maxZoom: 5,
  });
});

test("tile errors warn only when a full loading cycle has no successful tiles and recover on success", () => {
  const tracker = createTileLoadTracker();

  tracker.beginLoading();
  tracker.tileFailed();
  tracker.tileLoaded();
  assert.equal(tracker.finishLoading(), "available");

  tracker.beginLoading();
  tracker.tileFailed();
  tracker.tileFailed();
  assert.equal(tracker.finishLoading(), "unavailable");

  tracker.beginLoading();
  tracker.tileLoaded();
  assert.equal(tracker.finishLoading(), "available");
});

test("prepares only valid markers inside the selected polar region", () => {
  const markers = [
    { id: "antarctic", location: "-70, 30", label: "Field team", color: "#0284c7" },
    { id: "arctic", location: "70, 30", label: "Station", color: "#16a34a" },
    { id: "invalid", location: "not a coordinate", label: "Invalid", color: "#64748b" },
    { id: "missing", location: null, label: "Missing", color: "#64748b" },
    {
      id: "emergency",
      location: { latitude: -60, longitude: 0 },
      label: "SOS",
      color: "#dc2626",
      kind: "emergency" as const,
    },
  ];

  const antarctic = preparePolarMapMarkers(markers, "antarctic");
  const arctic = preparePolarMapMarkers(markers, "arctic");

  assert.deepEqual(antarctic.map(({ id }) => id), ["antarctic", "emergency"]);
  assert.deepEqual(arctic.map(({ id }) => id), ["arctic"]);
  assert.deepEqual(antarctic[1].position, [-60, 0]);
  assert.equal(antarctic[1].kind, "emergency");
});

test("constrains projected map centers within each region's viewport limit", () => {
  for (const region of ["antarctic", "arctic"] as const) {
    const maxDistance = getMaxProjectedDistanceFromPole(region);
    const viewportRadius = maxDistance / 4;
    const constrained = constrainPolarProjectedCenter(
      [maxDistance * 2, maxDistance],
      region,
      viewportRadius,
    );

    assert.ok(Number.isFinite(constrained[0]));
    assert.ok(Number.isFinite(constrained[1]));
    assert.ok(Math.hypot(...constrained) <= maxDistance - viewportRadius + 0.001);
    assert.ok(Math.hypot(...constrained) > 0);
  }
});
