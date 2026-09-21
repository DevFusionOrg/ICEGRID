import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./components/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { ResourcePage } from "./pages/ResourcePage";
import { CargoTrackingPage } from "./pages/CargoTrackingPage";

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="expeditions" element={<ResourcePage />} /><Route path="cargo" element={<CargoTrackingPage />} /><Route path="inventory" element={<ResourcePage />} /><Route path="personnel" element={<ResourcePage />} /><Route path="emergency" element={<ResourcePage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>;
}
