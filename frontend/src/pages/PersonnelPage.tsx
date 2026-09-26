import { useQuery } from "@tanstack/react-query";
import { MapPinned, Users } from "lucide-react";
import { useState } from "react";
import { Expedition, Personnel, getCollection } from "../lib/api";
import { PolarMap } from "../components/PolarMap";
import { useAuthStore } from "../stores/auth";

const statusColors: Record<string, string> = { ASSIGNED: "#0284c7", ON_SITE: "#16a34a", RETURNED: "#64748b", INACTIVE: "#dc2626" };

export function PersonnelPage() {
  const token = useAuthStore((state) => state.token);
  const [region, setRegion] = useState<"antarctic" | "arctic">("antarctic");
  const personnel = useQuery({ queryKey: ["personnel", "roster"], queryFn: () => getCollection<Personnel>("/personnel?pageSize=100", token!), enabled: Boolean(token) });
  const expeditions = useQuery({ queryKey: ["personnel", "expeditions"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const expeditionNames = new Map(expeditions.data?.data.map((item) => [item.id, item.name]));
  const roster = personnel.data?.data ?? [];
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Field operations</p><h2 className="mt-2 text-3xl font-bold">Personnel roster</h2><p className="mt-2 text-sm text-slate-500">Current status and last-known field positions.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold"><Users className="h-4 w-4 text-sky-600" />{roster.length} personnel</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Expedition</th><th className="px-5 py-3">Last known location</th></tr></thead><tbody className="divide-y divide-slate-100">{roster.map((person) => <tr key={person.id}><td className="px-5 py-4 font-semibold">{person.firstName} {person.lastName}</td><td className="px-5 py-4">{person.role}</td><td className="px-5 py-4"><span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ color: statusColors[person.status] ?? "#475569", backgroundColor: `${statusColors[person.status] ?? "#475569"}18` }}>{person.status.replace(/_/g, " ")}</span></td><td className="px-5 py-4 text-slate-500">{expeditionNames.get(person.expeditionId) ?? "—"}</td><td className="px-5 py-4 text-slate-500">{person.lastKnownLocation ?? "Not reported"}</td></tr>)}</tbody></table></div>{roster.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No personnel records yet.</p>}</section>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="flex items-center gap-2 font-semibold"><MapPinned className="h-4 w-4 text-sky-600" />Last-known locations</h3><select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={region} onChange={(event) => setRegion(event.target.value as "antarctic" | "arctic")}><option value="antarctic">Antarctic · EPSG:3031</option><option value="arctic">Arctic · EPSG:3995</option></select></div><div className="h-[520px] bg-slate-100"><PolarMap markers={roster.map((person) => ({ id: person.id, location: person.currentLocation ?? person.lastKnownLocation, label: `${person.firstName} ${person.lastName}`, detail: `${person.role} · ${person.status}`, color: statusColors[person.status] ?? "#0284c7" }))} region={region} /></div><p className="px-5 py-3 text-xs text-slate-400">Only personnel with valid latitude,longitude coordinates are plotted.</p></section>
    </div>
  </div>;
}
