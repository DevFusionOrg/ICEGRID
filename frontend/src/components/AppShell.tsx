import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { AlertTriangle, Boxes, Compass, LayoutDashboard, LogOut, Package, Snowflake, Users } from "lucide-react";
import { getCollection } from "../lib/api";
import { roleLabels, useAuthStore } from "../stores/auth";
import { OfflineStatus } from "./OfflineStatus";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Expeditions", path: "/expeditions", icon: Compass },
  { label: "Cargo", path: "/cargo", icon: Package },
  { label: "Inventory", path: "/inventory", icon: Boxes },
  { label: "Personnel", path: "/personnel", icon: Users },
  { label: "Emergency", path: "/emergency", icon: AlertTriangle },
];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => getCollection("/expeditions?pageSize=1", useAuthStore.getState().token!),
    enabled: Boolean(user),
  });

  return (
    <div className="min-h-screen bg-slate-50 text-polar-900">
      <aside className="fixed inset-y-0 hidden w-64 flex-col bg-polar-900 text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <Snowflake className="h-7 w-7 text-sky-300" />
          <div><p className="font-bold tracking-[0.2em]">NCPOR</p><p className="text-[10px] uppercase tracking-wider text-slate-400">Mission control</p></div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive ? "bg-sky-600 font-semibold" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="h-5 w-5" />{label}</NavLink>)}
        </nav>
        <button className="m-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white" onClick={logout}><LogOut className="h-5 w-5" />Sign out</button>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-10">
          <div><p className="text-sm text-slate-500">Operations overview</p><h1 className="text-xl font-bold">Polar mission control</h1></div>
          <div className="flex items-center gap-3"><OfflineStatus /><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{user?.name}</p><p className="text-xs text-slate-500">{user?.email}</p></div><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{user ? roleLabels[user.role] : ""}</span><button className="text-slate-500 lg:hidden" onClick={logout} aria-label="Sign out"><LogOut className="h-5 w-5" /></button></div>
        </header>
        <main className="p-6 lg:p-10"><Outlet context={{ expeditionCount: data?.pagination.total ?? 0 }} /></main>
      </div>
    </div>
  );
}
