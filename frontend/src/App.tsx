import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./components/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { ResourcePage } from "./pages/ResourcePage";
import { CargoTrackingPage } from "./pages/CargoTrackingPage";
import { EmergencyPage } from "./pages/EmergencyPage";
import { PlanningPage } from "./pages/PlanningPage";
import { InventoryPage } from "./pages/InventoryPage";
import { PersonnelPage } from "./pages/PersonnelPage";

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="expeditions" element={<PlanningPage />} /><Route path="cargo" element={<CargoTrackingPage />} /><Route path="inventory" element={<InventoryPage />} /><Route path="personnel" element={<PersonnelPage />} /><Route path="emergency" element={<EmergencyPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>;
}
