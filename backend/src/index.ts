/**
 * Cloudflare Worker entry point.
 *
 * A Hono gateway that:
 *  - Serves SSE realtime events at /api/realtime/*
 *  - Returns a health check at /api/health
 *  - Delegates all other requests to the existing Express app
 *    (which uses Prisma connected to Supabase via DATABASE_URL)
 */
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createServer } from "node:http";
import { app as expressApp } from "./app.js";
import realtimeRoutes from "./realtimeRoutes.js";

export const honoApp = new Hono();

// CORS — must come first
honoApp.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// SSE realtime endpoint (Cloudflare-native, no Socket.IO)
honoApp.route("/api/realtime", realtimeRoutes);

// Health check
honoApp.get("/api/health", (c) =>
  c.json({ status: "ok", service: "ncpors-backend", runtime: "cloudflare-workers" }),
);

// All other traffic → Express app via a thin adapter
honoApp.all("*", async (c) => {
  // Convert Web Request → Node IncomingMessage via a temporary http.Server
  const response = await new Promise<Response>((resolve, reject) => {
    const server = createServer((req, res) => {
      // Forward Express response to Web Response
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
        resolve(
          new Response(body, {
            status: res.statusCode ?? 200,
            headers: res.getHeaders() as Record<string, string>,
          }),
        );
      });
      res.on("error", reject);
      expressApp(req as any, res as any, () => {});
    });
    server.emit("request", c.req.raw as any, {} as any);
    server.close();
  });
  return response;
});

// Cloudflare Worker default export
export default {
  fetch: honoApp.fetch.bind(honoApp),
};
