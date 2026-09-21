import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./auth/routes.js";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "ncpors-backend" });
});
