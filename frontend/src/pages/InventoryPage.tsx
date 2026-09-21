import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Edit3, PackagePlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Expedition, InventoryItem, createInventoryItem, getCollection, updateInventoryItem } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const emptyForm = { sku: "", name: "", quantity: "0", reorderThreshold: "0", unit: "unit", location: "", expeditionId: "" };

export function InventoryPage() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const inventory = useQuery({ queryKey: ["inventory", "stock"], queryFn: () => getCollection<InventoryItem>("/inventory-items?pageSize=100", token!), enabled: Boolean(token) });
  const expeditions = useQuery({ queryKey: ["inventory", "expeditions"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), enabled: Boolean(token) });
  const save = useMutation({
    mutationFn: () => editing
      ? updateInventoryItem(token!, editing.id, { ...form, quantity: Number(form.quantity), reorderThreshold: Number(form.reorderThreshold), expeditionId: form.expeditionId || null, location: form.location || null })
      : createInventoryItem(token!, { ...form, quantity: Number(form.quantity), reorderThreshold: Number(form.reorderThreshold), expeditionId: form.expeditionId || null, location: form.location || null, sku: form.sku }),
    onSuccess: () => { setEditing(null); setForm(emptyForm); void queryClient.invalidateQueries({ queryKey: ["inventory"] }); },
  });

  useEffect(() => {
    if (!editing) return;
    setForm({ sku: editing.sku, name: editing.name, quantity: String(editing.quantity), reorderThreshold: String(editing.reorderThreshold), unit: editing.unit, location: editing.location ?? "", expeditionId: editing.expeditionId ?? "" });
  }, [editing]);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Stock control</p><h2 className="mt-2 text-3xl font-bold">Inventory</h2><p className="mt-2 text-sm text-slate-500">Monitor quantities and reorder thresholds across field stores.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="font-semibold">Stock table</h3><span className="text-xs text-slate-500">{inventory.data?.pagination.total ?? 0} items</span></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Reorder at</th><th className="px-5 py-3">Location</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{inventory.data?.data.map((item) => { const low = item.quantity < item.reorderThreshold; return <tr key={item.id} className={low ? "bg-red-50 text-red-950" : ""}><td className="px-5 py-4"><div className="flex items-center gap-2 font-semibold">{low && <AlertOctagon className="h-4 w-4 text-red-600" />}{item.name}</div><p className="text-xs text-slate-500">{item.unit}</p></td><td className="px-5 py-4 font-mono text-xs">{item.sku}</td><td className="px-5 py-4 font-semibold">{item.quantity}</td><td className="px-5 py-4">{item.reorderThreshold}</td><td className="px-5 py-4 text-slate-500">{item.location || "—"}</td><td className="px-5 py-4 text-right"><button className="text-sky-700 hover:underline" onClick={() => setEditing(item)}><Edit3 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div>{!inventory.data?.data.length && <p className="p-10 text-center text-sm text-slate-500">No inventory items yet.</p>}</section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-semibold"><PackagePlus className="h-4 w-4 text-sky-600" />{editing ? "Edit stock item" : "Add stock item"}</h3><form className="mt-5 space-y-3" onSubmit={submit}><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Item name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="SKU" required disabled={Boolean(editing)} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /><div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">Quantity<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" type="number" min="0" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label className="text-xs text-slate-500">Reorder threshold<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" type="number" min="0" required value={form.reorderThreshold} onChange={(event) => setForm({ ...form, reorderThreshold: event.target.value })} /></label></div><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Unit (e.g. boxes)" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /><input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /><select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.expeditionId} onChange={(event) => setForm({ ...form, expeditionId: event.target.value })}><option value="">No expedition</option>{expeditions.data?.data.map((expedition) => <option key={expedition.id} value={expedition.id}>{expedition.name}</option>)}</select><div className="flex gap-2"><button className="flex-1 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-700 disabled:opacity-50" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Add item"}</button>{editing && <button type="button" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" onClick={() => setEditing(null)}>Cancel</button>}</div></form></section>
    </div>
  </div>;
}
