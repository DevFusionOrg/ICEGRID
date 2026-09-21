import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "proj4leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import { io } from "socket.io-client";
import { AlertTriangle, BellRing, CheckCircle2, LocateFixed, Radio } from "lucide-react";
import { AlertSeverity, EmergencyAlert, createAlert, getCollection, resolveAlert } from "../lib/api";
import { enqueueRequest } from "../lib/offlineQueue";
import { useAuthStore } from "../stores/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
const colors: Record<AlertSeverity, string> = { LOW: "#0284c7", MEDIUM: "#d97706", HIGH: "#ea580c", CRITICAL: "#dc2626" };
type ProjLeaflet = typeof L & { Proj: { CRS: new (code: string, definition: string, options: object) => L.CRS } };
const ProjectedLeaflet = L as ProjLeaflet;
const projectionOptions = { resolutions: [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1], origin: [-4194304, 4194304] };
const antarctic = new ProjectedLeaflet.Proj.CRS("EPSG:3031", "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +datum=WGS84 +units=m +no_defs", projectionOptions);
const arctic = new ProjectedLeaflet.Proj.CRS("EPSG:3995", "+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +datum=WGS84 +units=m +no_defs", projectionOptions);

function parseLocation(location: string | null): [number, number] | null {
  const match = location?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const point: [number, number] = [Number(match[1]), Number(match[2])];
  return point[0] >= -90 && point[0] <= 90 && point[1] >= -180 && point[1] <= 180 ? point : null;
}

function alertIcon(severity: AlertSeverity) {
  return L.divIcon({ className: "alert-marker", html: `<span style="background:${colors[severity]}"></span>`, iconSize: [20, 20], iconAnchor: [10, 10] });
}

function AlertMap({ alerts, region }: { alerts: EmergencyAlert[]; region: "antarctic" | "arctic" }) {
  const crs = region === "arctic" ? arctic : antarctic;
  return <MapContainer key={region} className="h-full min-h-[420px] w-full" crs={crs} center={[0, 0]} zoom={2} scrollWheelZoom>
    {alerts.filter((alert) => alert.status !== "RESOLVED").map((alert) => {
      const point = parseLocation(alert.location);
      return point ? <Marker key={alert.id} position={point} icon={alertIcon(alert.severity)}><Popup><strong>{alert.title}</strong><br />{alert.message}<br />{alert.severity}</Popup></Marker> : null;
    })}
  </MapContainer>;
}

export function EmergencyPage() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [region, setRegion] = useState<"antarctic" | "arctic">("antarctic");
  const [sosMessage, setSosMessage] = useState("");
  const [sosError, setSosError] = useState("");
  const alertQuery = useQuery({ queryKey: ["alerts", "dashboard"], queryFn: () => getCollection<EmergencyAlert>("/alerts?pageSize=100", token!), enabled: Boolean(token) });
  const expeditions = useQuery({ queryKey: ["expeditions", "sos"], queryFn: () => getCollection<{ id: string; name: string }>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const resolveMutation = useMutation({ mutationFn: (id: string) => resolveAlert(token!, id), onSuccess: (updated) => setAlerts((current) => current.map((alert) => alert.id === updated.id ? updated : alert)) });
  const sosMutation = useMutation({
    mutationFn: async (location: string | null) => {
      const body = { expeditionId: expeditions.data?.data[0]?.id ?? "", title: "SOS from field personnel", message: sosMessage || "Immediate assistance requested.", severity: "CRITICAL" as const, location };
      if (!navigator.onLine) {
        await enqueueRequest({ path: "/alerts", method: "POST", body, token: token! });
        return null;
      }
      return createAlert(token!, body);
    },
    onSuccess: (created) => { if (created) setAlerts((current) => [created, ...current]); setSosMessage(""); setSosError(""); },
    onError: (error) => setSosError(error instanceof Error ? error.message : "Unable to raise SOS"),
  });

  useEffect(() => { if (alertQuery.data?.data) setAlerts(alertQuery.data.data); }, [alertQuery.data]);
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on("alert:new", (alert: EmergencyAlert) => { setAlerts((current) => [alert, ...current.filter((item) => item.id !== alert.id)]); void queryClient.invalidateQueries({ queryKey: ["alerts", "dashboard"] }); });
    return () => { socket.disconnect(); };
  }, [queryClient, token]);

  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.status !== "RESOLVED" && alert.status !== "DISMISSED"), [alerts]);
  const newestFirst = useMemo(() => [...alerts].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [alerts]);
  const raiseSos = () => {
    if (!expeditions.data?.data[0]) { setSosError("An expedition is required before raising an SOS."); return; }
    if (!navigator.geolocation) { sosMutation.mutate(null); return; }
    navigator.geolocation.getCurrentPosition((position) => sosMutation.mutate(`${position.coords.latitude},${position.coords.longitude}`), () => sosMutation.mutate(null), { enableHighAccuracy: true, timeout: 8000 });
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-red-600">Emergency response</p><h2 className="mt-2 text-3xl font-bold">Live alert dashboard</h2><p className="mt-2 text-sm text-slate-500">Monitor, acknowledge, and respond to field incidents.</p></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Radio className="h-4 w-4" />Live feed connected</div></div>
    {user?.role === "FIELD_PERSONNEL" && <section className="rounded-2xl border border-red-200 bg-red-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="flex items-center gap-2 font-bold text-red-900"><AlertTriangle className="h-5 w-5" />Raise SOS</h3><p className="mt-1 text-sm text-red-700">Your browser location will be attached when available.</p></div><button className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50" onClick={raiseSos} disabled={sosMutation.isPending}><LocateFixed className="mr-2 inline h-4 w-4" />{sosMutation.isPending ? "Sending..." : "Raise SOS"}</button></div><input className="mt-4 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" placeholder="Optional message" value={sosMessage} onChange={(event) => setSosMessage(event.target.value)} />{sosError && <p className="mt-2 text-sm text-red-700">{sosError}</p>}</section>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="font-semibold">Active alert locations</h3><select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={region} onChange={(event) => setRegion(event.target.value as "antarctic" | "arctic")}><option value="antarctic">Antarctic · EPSG:3031</option><option value="arctic">Arctic · EPSG:3995</option></select></div><div className="h-[420px] bg-slate-100"><AlertMap alerts={activeAlerts} region={region} /></div></section>
      <section className="rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="font-semibold">Alert feed</h3><span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">{activeAlerts.length} active</span></div><div className="max-h-[500px] space-y-3 overflow-y-auto p-4">{newestFirst.map((alert) => <article key={alert.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold" style={{ color: colors[alert.severity] }}>{alert.severity}</span><h4 className="mt-1 font-semibold">{alert.title}</h4></div><BellRing className="h-4 w-4 text-slate-400" /></div><p className="mt-2 text-sm text-slate-600">{alert.message}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><time>{new Date(alert.createdAt).toLocaleString()}</time>{alert.status !== "RESOLVED" && <button className="font-semibold text-sky-700 hover:underline" onClick={() => resolveMutation.mutate(alert.id)}>Resolve</button>}</div></article>)}</div></section></div>
  </div>;
}
