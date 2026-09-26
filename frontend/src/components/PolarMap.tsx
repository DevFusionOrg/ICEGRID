import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "proj4leaflet";
import { MapContainer, Marker, Popup } from "react-leaflet";
import type { LocationPoint } from "../lib/api";

type ProjLeaflet = typeof L & { Proj: { CRS: new (code: string, definition: string, options: object) => L.CRS } };
const ProjectedLeaflet = L as ProjLeaflet;
const projectionOptions = { resolutions: [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1], origin: [-4194304, 4194304] };
const projections = {
  antarctic: new ProjectedLeaflet.Proj.CRS("EPSG:3031", "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +datum=WGS84 +units=m +no_defs", projectionOptions),
  arctic: new ProjectedLeaflet.Proj.CRS("EPSG:3995", "+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +datum=WGS84 +units=m +no_defs", projectionOptions),
};

export type MapLocation = Pick<LocationPoint, "latitude" | "longitude"> | string | null;

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

export type PolarMarker = { id: string; location: MapLocation; label: string; detail?: string; color: string };

export function PolarMap({ markers, region, className = "h-full min-h-[560px] w-full" }: { markers: PolarMarker[]; region: "antarctic" | "arctic"; className?: string }) {
  return <MapContainer key={region} className={className} crs={projections[region]} center={[0, 0]} zoom={2} scrollWheelZoom>
    {markers.map((marker) => {
      const point = parsePolarLocation(marker.location);
      return point ? <Marker key={marker.id} position={point} icon={L.divIcon({ className: "cargo-marker", html: `<span style="background:${marker.color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] })}><Popup><strong>{marker.label}</strong>{marker.detail && <><br />{marker.detail}</>}</Popup></Marker> : null;
    })}
  </MapContainer>;
}
