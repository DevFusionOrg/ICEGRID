import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Compass, PackageCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CargoItem, EmergencyAlert, Expedition, InventoryItem, getCollection } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const COLORS = ["#0284c7", "#16a34a", "#dc2626", "#64748b"];

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const options = { enabled: Boolean(token) };
  const expeditions = useQuery({ queryKey: ["dashboard", "expeditions"], queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!), ...options });
  const cargo = useQuery({ queryKey: ["dashboard", "cargo"], queryFn: () => getCollection<CargoItem>("/cargo-items?pageSize=100", token!), ...options });
  const alerts = useQuery({ queryKey: ["dashboard", "alerts"], queryFn: () => getCollection<EmergencyAlert>("/alerts?pageSize=100", token!), ...options });
  const inventory = useQuery({ queryKey: ["dashboard", "inventory"], queryFn: () => getCollection<InventoryItem>("/inventory-items?pageSize=100", token!), ...options });
  const activeExpeditions = expeditions.data?.data.filter((item) => item.status === "ACTIVE").length ?? 0;
  const cargoItems = cargo.data?.data ?? [];
  const inTransit = cargoItems.filter((item) => item.status === "IN_TRANSIT").length;
  const delivered = cargoItems.filter((item) => item.status === "RECEIVED" || item.status === "AT_DESTINATION").length;
  const openAlerts = alerts.data?.data.filter((item) => item.status === "OPEN" || item.status === "ACKNOWLEDGED").length ?? 0;
  const lowStock = inventory.data?.data.filter((item) => item.quantity < item.reorderThreshold).length ?? 0;
  const cargoChart = [{ name: "In transit", value: inTransit }, { name: "Delivered", value: delivered }, { name: "Other", value: Math.max(0, cargoItems.length - inTransit - delivered) }];
  const expeditionChart = (expeditions.data?.data ?? []).map((item) => ({ name: item.code, active: item.status === "ACTIVE" ? 1 : 0, planned: item.status === "PLANNED" ? 1 : 0 }));
  const stockChart = [{ name: "Healthy", value: Math.max(0, (inventory.data?.data.length ?? 0) - lowStock) }, { name: "Reorder", value: lowStock }];

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Good day</p><h2 className="mt-2 text-3xl font-bold">Mission dashboard</h2><p className="mt-2 text-sm text-slate-500">A live summary of expedition readiness and field logistics.</p></div>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Active expeditions", value: activeExpeditions, icon: Compass, color: "text-sky-600" },
        { label: "Cargo in transit", value: inTransit, icon: PackageCheck, color: "text-violet-600" },
        { label: "Open alerts", value: openAlerts, icon: AlertTriangle, color: "text-red-600" },
        { label: "Low-stock items", value: lowStock, icon: Boxes, color: "text-amber-600" },
      ].map(({ label, value, icon: Icon, color }) => <div className="rounded-2xl bg-white p-5 shadow-sm" key={label}><Icon className={`h-5 w-5 ${color}`} /><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-4xl font-bold">{value}</p></div>)}
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-semibold">Cargo flow</h3><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={cargoChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>{cargoChart.map((entry, index) => <Cell key={entry.name} fill={COLORS[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-semibold">Expedition status</h3><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={expeditionChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="active" name="Active" fill="#0284c7" /><Bar dataKey="planned" name="Planned" fill="#94a3b8" /></BarChart></ResponsiveContainer></div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-semibold">Inventory readiness</h3><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stockChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>{stockChart.map((entry, index) => <Cell key={entry.name} fill={index === 1 ? "#dc2626" : "#16a34a"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><p className="text-center text-xs text-slate-500">{lowStock} items below reorder threshold</p></section>
    </div>
  </div>;
}
