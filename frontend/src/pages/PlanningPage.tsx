import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, PackagePlus, Plus, UserPlus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { CargoItem, Expedition, Personnel, createCargoItem, createExpedition, createPersonnel, getCollection } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const DAY = 86_400_000;
const toDate = (value: string | null) => value ? new Date(value) : null;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not scheduled";

function DateBar({ startDate, endDate }: { startDate: string | null; endDate: string | null }) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || end <= start) return <span className="text-xs text-slate-400">Timeline dates not set</span>;
  const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
  const days = Math.min(total, 28);
  return <div className="min-w-[260px]"><div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>{formatDate(startDate)}</span><span>{formatDate(endDate)}</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-sky-500" style={{ width: `${Math.max(8, (days / total) * 100)}%` }} /></div></div>;
}

export function PlanningPage() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [personnelName, setPersonnelName] = useState("");
  const [cargoName, setCargoName] = useState("");
  const [message, setMessage] = useState("");
  const expeditions = useQuery({ queryKey: ["planning", "expeditions"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const people = useQuery({ queryKey: ["planning", "personnel"], queryFn: () => getCollection<Personnel>("/personnel?pageSize=100", token!), enabled: Boolean(token) });
  const cargo = useQuery({ queryKey: ["planning", "cargo"], queryFn: () => getCollection<CargoItem>("/cargo-items?pageSize=100", token!), enabled: Boolean(token) });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["planning"] }); };
  const create = useMutation({
    mutationFn: () => createExpedition(token!, { name, code, destination: destination || null, startDate: startDate || null, endDate: endDate || null }),
    onSuccess: (expedition) => { setSelectedId(expedition.id); setName(""); setCode(""); setDestination(""); setStartDate(""); setEndDate(""); setMessage("Expedition created."); invalidate(); },
  });
  const assignPerson = useMutation({ mutationFn: () => createPersonnel(token!, { expeditionId: selectedId, firstName: personnelName.split(" ")[0], lastName: personnelName.split(" ").slice(1).join(" ") || "Member" }), onSuccess: () => { setPersonnelName(""); setMessage("Personnel assigned."); invalidate(); } });
  const assignCargo = useMutation({ mutationFn: () => createCargoItem(token!, { expeditionId: selectedId, trackingCode: `TRACK-${Date.now()}`, name: cargoName }), onSuccess: () => { setCargoName(""); setMessage("Cargo assigned."); invalidate(); } });
  const selected = useMemo(() => expeditions.data?.data.find((item) => item.id === selectedId), [expeditions.data, selectedId]);

  function submit(event: FormEvent) { event.preventDefault(); setMessage(""); create.mutate(); }

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Mission planning</p><h2 className="mt-2 text-3xl font-bold">Expedition planning</h2><p className="mt-2 text-sm text-slate-500">Create missions and coordinate their people, cargo, and operating window.</p></div>
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-sky-600" />New expedition</h3><form className="mt-5 space-y-4" onSubmit={submit}><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Expedition name" required value={name} onChange={(event) => setName(event.target.value)} /><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Code (e.g. M42)" required value={code} onChange={(event) => setCode(event.target.value)} /><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Destination" value={destination} onChange={(event) => setDestination(event.target.value)} /><div className="grid grid-cols-2 gap-3"><input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div><button className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-700 disabled:opacity-50" disabled={create.isPending}>{create.isPending ? "Creating..." : "Create expedition"}</button></form>{message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}</section>
      <section className="rounded-2xl bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold"><CalendarRange className="h-4 w-4 text-sky-600" />Expedition timeline</div><div className="divide-y divide-slate-100">{expeditions.data?.data.map((item) => <button className={`grid w-full gap-4 px-5 py-4 text-left md:grid-cols-[1fr_180px] ${selectedId === item.id ? "bg-sky-50" : "hover:bg-slate-50"}`} key={item.id} onClick={() => setSelectedId(item.id)}><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.code} · {item.destination || "Destination pending"}</p></div><DateBar startDate={item.startDate} endDate={item.endDate} /></button>)}</div>{!expeditions.data?.data.length && <p className="p-8 text-center text-sm text-slate-500">No expeditions yet.</p>}</section>
    </div>
    {selected && <section className="rounded-2xl bg-white p-5 shadow-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Selected expedition</p><h3 className="mt-1 text-xl font-bold">{selected.name}</h3><p className="text-sm text-slate-500">{formatDate(selected.startDate)} — {formatDate(selected.endDate)}</p></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-xl border border-slate-100 p-4"><h4 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-sky-600" />Assign personnel</h4><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); assignPerson.mutate(); }}><input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Full name" required value={personnelName} onChange={(event) => setPersonnelName(event.target.value)} /><button className="rounded-lg bg-slate-900 px-3 py-2 text-white" disabled={assignPerson.isPending}>Assign</button></form><p className="mt-3 text-xs text-slate-500">{people.data?.data.filter((person) => person.expeditionId === selected.id).length ?? 0} assigned</p></div><div className="rounded-xl border border-slate-100 p-4"><h4 className="flex items-center gap-2 font-semibold"><PackagePlus className="h-4 w-4 text-sky-600" />Assign cargo</h4><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); assignCargo.mutate(); }}><input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Cargo item name" required value={cargoName} onChange={(event) => setCargoName(event.target.value)} /><button className="rounded-lg bg-slate-900 px-3 py-2 text-white" disabled={assignCargo.isPending}>Assign</button></form><p className="mt-3 text-xs text-slate-500">{cargo.data?.data.filter((item) => item.expeditionId === selected.id).length ?? 0} assigned</p></div></div></section>}
  </div>;
}
