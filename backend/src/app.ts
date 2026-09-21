import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./auth/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { alertRoutes, cargoRoutes, expeditionRoutes, inventoryRoutes, personnelRoutes } from "./api/crud.js";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/expeditions", requireAuth, expeditionRoutes);
app.use("/api/personnel", requireAuth, personnelRoutes);
app.use("/api/cargo-items", requireAuth, cargoRoutes);
app.use("/api/inventory-items", requireAuth, inventoryRoutes);
app.use("/api/emergency-alerts", requireAuth, alertRoutes);
app.use("/api/alerts", requireAuth, alertRoutes);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "ncpors-backend" });
});
