import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CargoTrackingPage } from "./pages/CargoTrackingPage";
import { EmergencyPage } from "./pages/EmergencyPage";
import { PlanningPage } from "./pages/PlanningPage";
import { InventoryPage } from "./pages/InventoryPage";
import { PersonnelPage } from "./pages/PersonnelPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/expeditions" element={<PlanningPage />} />
            <Route path="/cargo" element={<CargoTrackingPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/personnel" element={<PersonnelPage />} />
            <Route path="/emergency" element={<EmergencyPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
