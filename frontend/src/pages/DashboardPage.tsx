import { useOutletContext } from "react-router-dom";

export function DashboardPage() {
  const { expeditionCount } = useOutletContext<{ expeditionCount: number }>();
  return <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Good day</p><h2 className="mt-2 text-3xl font-bold">Mission dashboard</h2><div className="mt-8 grid gap-5 md:grid-cols-3"><div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Active expeditions</p><p className="mt-3 text-4xl font-bold">{expeditionCount}</p></div><div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Cargo readiness</p><p className="mt-3 text-4xl font-bold">—</p></div><div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Open alerts</p><p className="mt-3 text-4xl font-bold">—</p></div></div></div>;
}
