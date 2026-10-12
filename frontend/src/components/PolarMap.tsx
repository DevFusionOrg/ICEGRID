import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "proj4leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import {
  POLAR_MAP_ATTRIBUTION,
  POLAR_REGION_DEFINITIONS,
} from "../lib/polarMapConfig";
import type { MapLocation, PolarRegion } from "../lib/polarMapConfig";
import {
  constrainPolarProjectedCenter,
  createTileLoadTracker,
  getPolarInitialView,
  getPolarTileUrl,
  preparePolarMapMarkers,
} from "../lib/polarMapPresentation";
import type { PolarMapMarker } from "../lib/polarMapPresentation";

export type { MapLocation } from "../lib/polarMapConfig";
export { parsePolarLocation } from "../lib/polarMapConfig";
export type PolarMarker = PolarMapMarker;

type ProjLeaflet = typeof L & {
  Proj: {
    CRS: new (
      code: string,
      definition: string,
      options: { origin: number[]; resolutions: number[] },
    ) => L.CRS;
  };
};

const ProjectedLeaflet = L as ProjLeaflet;
const projections: Record<PolarRegion, L.CRS> = {
  antarctic: createPolarCrs("antarctic"),
  arctic: createPolarCrs("arctic"),
};

function createPolarCrs(region: PolarRegion): L.CRS {
  const definition = POLAR_REGION_DEFINITIONS[region];
  const resolutions = [...definition.resolutions];
  while (resolutions.length <= definition.maxZoom) {
    resolutions.push(resolutions[resolutions.length - 1] / 2);
  }
  return new ProjectedLeaflet.Proj.CRS(definition.epsg, definition.proj4, {
    origin: [...definition.gridOrigin],
    resolutions,
  });
}

function PolarViewportLimiter({ region }: { region: PolarRegion }) {
  const map = useMap();

  useEffect(() => {
    const constrainCenter = () => {
      const zoom = map.getZoom();
      const crs = map.options.crs;
      if (!crs) return;
      const center = crs.project(map.getCenter());
      const pixelBounds = map.getPixelBounds();
      if (!pixelBounds.min || !pixelBounds.max) return;
      const corners = [
        pixelBounds.min,
        new L.Point(pixelBounds.max.x, pixelBounds.min.y),
        pixelBounds.max,
        new L.Point(pixelBounds.min.x, pixelBounds.max.y),
      ];
      const viewportRadius = Math.max(
        ...corners.map((pixel) => {
          const projected = crs.project(map.unproject(pixel, zoom));
          return Math.hypot(projected.x - center.x, projected.y - center.y);
        }),
      );
      const constrained = constrainPolarProjectedCenter(
        [center.x, center.y],
        region,
        viewportRadius,
      );

      if (
        Math.abs(constrained[0] - center.x) > 1 ||
        Math.abs(constrained[1] - center.y) > 1
      ) {
        map.setView(
          crs.unproject(L.point(constrained[0], constrained[1])),
          zoom,
          { animate: false },
        );
      }
    };

    map.on("moveend zoomend", constrainCenter);
    constrainCenter();
    return () => {
      map.off("moveend zoomend", constrainCenter);
    };
  }, [map, region]);

  return null;
}

export function PolarMap({
  markers,
  region,
  className = "h-full min-h-[560px] w-full",
  onMarkerCountChange,
}: {
  markers: PolarMarker[];
  region: PolarRegion;
  className?: string;
  /** Reports the plotted count on mount and whenever the count or region changes. */
  onMarkerCountChange?: (count: number) => void;
}) {
  const definition = POLAR_REGION_DEFINITIONS[region];
  const initialView = useMemo(() => getPolarInitialView(region), [region]);
  const plottedMarkers = useMemo(
    () => preparePolarMapMarkers(markers, region),
    [markers, region],
  );
  const tileUrl = useMemo(() => getPolarTileUrl(region), [region]);
  const [imageryStatus, setImageryStatus] = useState<"loading" | "available" | "unavailable" | "recovered">("loading");
  const imageryStatusRef = useRef(imageryStatus);
  const tileLoadTracker = useRef(createTileLoadTracker());
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerCountCallback = useRef(onMarkerCountChange);
  markerCountCallback.current = onMarkerCountChange;

  useEffect(() => {
    markerCountCallback.current?.(plottedMarkers.length);
  }, [plottedMarkers.length, region]);

  useEffect(() => {
    imageryStatusRef.current = "loading";
    setImageryStatus("loading");
    tileLoadTracker.current.beginLoading();
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
  }, [region]);

  useEffect(
    () => () => {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    },
    [],
  );

  const tileEventHandlers = useMemo(
    () => ({
      loading: () => {
        tileLoadTracker.current.beginLoading();
      },
      tileerror: () => {
        tileLoadTracker.current.tileFailed();
      },
      tileload: () => {
        tileLoadTracker.current.tileLoaded();
      },
      load: () => {
        const result = tileLoadTracker.current.finishLoading();
        if (result === "unknown") return;

        const nextStatus = result === "available" && imageryStatusRef.current === "unavailable"
          ? "recovered"
          : result;
        imageryStatusRef.current = nextStatus;
        setImageryStatus(nextStatus);

        if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
        if (nextStatus === "recovered") {
          recoveryTimer.current = setTimeout(() => {
            recoveryTimer.current = null;
            imageryStatusRef.current = "available";
            setImageryStatus("available");
          }, 2500);
        }
      },
    }),
    [],
  );

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-label={`${definition.label} polar map`}
    >
      <MapContainer
        key={region}
        className="h-full w-full"
        crs={projections[region]}
        center={initialView.center}
        zoom={initialView.zoom}
        minZoom={initialView.minZoom}
        maxZoom={initialView.maxZoom}
        scrollWheelZoom
      >
        <TileLayer
          url={tileUrl}
          attribution={POLAR_MAP_ATTRIBUTION}
          tileSize={definition.tileSize}
          minZoom={definition.minZoom}
          maxZoom={definition.maxZoom}
          maxNativeZoom={definition.maxNativeZoom}
          eventHandlers={tileEventHandlers}
        />
        <PolarViewportLimiter region={region} />
        {plottedMarkers.map((marker) => {
          const isEmergency = marker.kind === "emergency";
          const accessibleLabel = isEmergency
            ? `Emergency alert: ${marker.label}`
            : marker.label;
          const icon = L.divIcon({
            className: isEmergency ? "alert-marker" : "cargo-marker",
            html: isEmergency
              ? `<span aria-hidden="true" style="background:${marker.color};line-height:14px;text-align:center;color:white;font-weight:bold">!</span>`
              : `<span aria-hidden="true" style="background:${marker.color}"></span>`,
            iconSize: isEmergency ? [20, 20] : [18, 18],
            iconAnchor: isEmergency ? [10, 10] : [9, 9],
          });

          return (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={icon}
              title={accessibleLabel}
              alt={accessibleLabel}
            >
              <Popup>
                <strong>{accessibleLabel}</strong>
                {marker.detail && (
                  <>
                    <br />
                    {marker.detail}
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {(imageryStatus === "unavailable" || imageryStatus === "recovered") && (
        <p
          className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow"
          role="status"
          aria-live="polite"
        >
          {imageryStatus === "unavailable"
            ? "NASA GIBS imagery is unavailable. Valid map markers remain available."
            : "NASA GIBS imagery has recovered."}
        </p>
      )}
    </div>
  );
}
