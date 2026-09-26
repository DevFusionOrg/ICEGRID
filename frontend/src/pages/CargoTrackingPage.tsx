import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Filter, MapPinned, Radio, Search } from "lucide-react";
import { CargoItem, CargoStatus, Expedition, getCollection, updateCargoLocation } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { PolarMap } from "../components/PolarMap";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
const STATUS_OPTIONS: Array<CargoStatus | "ALL"> = ["ALL", "PLANNED", "IN_TRANSIT", "AT_DESTINATION", "RECEIVED", "LOST"];
const statusColors: Record<CargoStatus, string> = { PLANNED: "#64748b", IN_TRANSIT: "#0284c7", AT_DESTINATION: "#7c3aed", RECEIVED: "#16a34a", LOST: "#dc2626" };
const formatStatus = (value: string) => value.replace(/_/g, " ");
export function CargoTrackingPage() {
  const token = useAuthStore((state) => state.token);
  const [cargo, setCargo] = useState<CargoItem[]>([]);
  const [status, setStatus] = useState<CargoStatus | "ALL">("ALL");
  const [expedition, setExpedition] = useState("ALL");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<"antarctic" | "arctic">("antarctic");
  const [locationItem, setLocationItem] = useState("");
  const [location, setLocation] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const expeditions = useQuery({ queryKey: ["expeditions", "cargo-filter"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const cargoQuery = useQuery({ queryKey: ["cargo", "tracking"], queryFn: () => getCollection<CargoItem>("/cargo-items?pageSize=100", token!), enabled: Boolean(token) });
  const submitLocation = async () => {
    if (!locationItem || !location.trim()) return;
    await updateCargoLocation(token!, locationItem, location.trim());
    setLocationMessage(navigator.onLine ? "Location sent." : "Location queued for sync.");
    setLocation("");
  };

  useEffect(() => { if (cargoQuery.data?.data) setCargo(cargoQuery.data.data); }, [cargoQuery.data]);
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on("cargo:update", (update: Pick<CargoItem, "id" | "location" | "status" | "updatedAt" | "currentLocation">) => {
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
        <div className="border-t border-slate-100 pt-4"><p className="text-sm font-semibold">Field location update</p><select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={locationItem} onChange={(event) => setLocationItem(event.target.value)}><option value="">Select cargo</option>{cargo.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="latitude,longitude" value={location} onChange={(event) => setLocation(event.target.value)} /><button className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => { void submitLocation(); }}>Save location</button>{locationMessage && <p className="mt-2 text-xs text-emerald-700">{locationMessage}</p>}</div>
        <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">{STATUS_OPTIONS.slice(1).map((item) => <div key={item} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[item as CargoStatus] }} />{formatStatus(item)}</div>)}</div>
      </aside>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="h-4 w-4 text-sky-600" />{filteredCargo.length} cargo items on map</div><Search className="h-4 w-4 text-slate-400" /></div><div className="h-[560px] bg-slate-100"><PolarMap markers={filteredCargo.map((item) => ({ id: item.id, location: item.currentLocation ?? item.location, label: item.name, detail: `${item.trackingCode} · ${item.status}`, color: statusColors[item.status] }))} region={region} /></div><p className="px-5 py-3 text-xs text-slate-400">Structured coordinates are used when available; older text locations remain supported.</p></section>
    </div>
  </div>;
}
