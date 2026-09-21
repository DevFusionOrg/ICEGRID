import { useLocation } from "react-router-dom";

const titles: Record<string, string> = { expeditions: "Expeditions", cargo: "Cargo", inventory: "Inventory", personnel: "Personnel", emergency: "Emergency alerts" };

export function ResourcePage() {
  const key = useLocation().pathname.split("/")[1] ?? "expeditions";
  return <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Operations</p><h2 className="mt-2 text-3xl font-bold">{titles[key] ?? "Operations"}</h2><div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No records to display yet.</div></div>;
}
