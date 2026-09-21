import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "proj4leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import { io } from "socket.io-client";
import { Filter, MapPinned, Radio, Search } from "lucide-react";
import { CargoItem, CargoStatus, Expedition, getCollection } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
const STATUS_OPTIONS: Array<CargoStatus | "ALL"> = ["ALL", "PLANNED", "IN_TRANSIT", "AT_DESTINATION", "RECEIVED", "LOST"];
const statusColors: Record<CargoStatus, string> = { PLANNED: "#64748b", IN_TRANSIT: "#0284c7", AT_DESTINATION: "#7c3aed", RECEIVED: "#16a34a", LOST: "#dc2626" };
const formatStatus = (value: string) => value.replace(/_/g, " ");
type ProjLeaflet = typeof L & { Proj: { CRS: new (code: string, definition: string, options: object) => L.CRS } };
const ProjectedLeaflet = L as ProjLeaflet;
const projectionOptions = { resolutions: [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1], origin: [-4194304, 4194304] };
const antarctic = new ProjectedLeaflet.Proj.CRS("EPSG:3031", "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs", projectionOptions);
const arctic = new ProjectedLeaflet.Proj.CRS("EPSG:3995", "+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs", projectionOptions);

function parseLocation(location: string | null): [number, number] | null {
  if (!location) return null;
  const match = location.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? [latitude, longitude] : null;
}

function createMarkerIcon(status: CargoStatus) {
  return L.divIcon({ className: "cargo-marker", html: `<span style="background:${statusColors[status]}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function PolarMap({ cargo, region }: { cargo: CargoItem[]; region: "antarctic" | "arctic" }) {
  const projection = region === "arctic" ? arctic : antarctic;
  return <MapContainer key={region} className="h-full min-h-[560px] w-full" crs={projection} center={[0, 0]} zoom={2} scrollWheelZoom>
    {cargo.map((item) => {
      const coordinates = parseLocation(item.location);
      if (!coordinates) return null;
      return <Marker key={item.id} position={coordinates} icon={createMarkerIcon(item.status)}><Popup><strong>{item.name}</strong><br />{item.trackingCode}<br />{item.status}</Popup></Marker>;
    })}
  </MapContainer>;
}

export function CargoTrackingPage() {
  const token = useAuthStore((state) => state.token);
  const [cargo, setCargo] = useState<CargoItem[]>([]);
  const [status, setStatus] = useState<CargoStatus | "ALL">("ALL");
  const [expedition, setExpedition] = useState("ALL");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<"antarctic" | "arctic">("antarctic");
  const expeditions = useQuery({ queryKey: ["expeditions", "cargo-filter"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const cargoQuery = useQuery({ queryKey: ["cargo", "tracking"], queryFn: () => getCollection<CargoItem>("/cargo-items?pageSize=100", token!), enabled: Boolean(token) });

  useEffect(() => { if (cargoQuery.data?.data) setCargo(cargoQuery.data.data); }, [cargoQuery.data]);
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on("cargo:update", (update: Pick<CargoItem, "id" | "location" | "status" | "updatedAt">) => {
      setCargo((current) => current.map((item) => item.id === update.id ? { ...item, ...update } : item));
    });
    return () => { socket.disconnect(); };
  }, [token]);

  const filteredCargo = useMemo(() => cargo.filter((item) => (status === "ALL" || item.status === status) && (expedition === "ALL" || item.expeditionId === expedition) && (!search || `${item.name} ${item.trackingCode}`.toLowerCase().includes(search.toLowerCase()))), [cargo, expedition, search, status]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Live operations</p><h2 className="mt-2 text-3xl font-bold">Cargo tracking</h2><p className="mt-2 text-sm text-slate-500">Polar-projected positions from field teams.</p></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Radio className="h-4 w-4" />Realtime connected</div></div>
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <aside className="space-y-5 rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-2 font-semibold"><Filter className="h-4 w-4 text-sky-600" />Filters</div>
        <label className="block text-sm font-medium text-slate-700">Search<input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Name or tracking code" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">Expedition<select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={expedition} onChange={(event) => setExpedition(event.target.value)}><option value="ALL">All expeditions</option>{expeditions.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Status<select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as CargoStatus | "ALL")}>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Polar projection<select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={region} onChange={(event) => setRegion(event.target.value as "antarctic" | "arctic")}><option value="antarctic">Antarctic (EPSG:3031)</option><option value="arctic">Arctic (EPSG:3995)</option></select></label>
        <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">{STATUS_OPTIONS.slice(1).map((item) => <div key={item} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[item as CargoStatus] }} />{formatStatus(item)}</div>)}</div>
      </aside>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="h-4 w-4 text-sky-600" />{filteredCargo.length} cargo items on map</div><Search className="h-4 w-4 text-slate-400" /></div><div className="h-[560px] bg-slate-100"><PolarMap cargo={filteredCargo} region={region} /></div><p className="px-5 py-3 text-xs text-slate-400">Locations use latitude,longitude strings (for example, -77.85,166.67). Items without coordinates remain in the filter list.</p></section>
    </div>
  </div>;
}
