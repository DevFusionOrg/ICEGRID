import { Router } from "express";
import { verifyAuthToken } from "./auth/jwt.js";
import { hasPermission, PERMISSIONS } from "./auth/roles.js";
import {
  handleExpeditionJoin,
  handleExpeditionLeave,
  registerRealtimeClient,
  unregisterRealtimeClient,
  type RealtimeClient,
  type RealtimeUser,
} from "./realtime.js";

const realtimeRouter = Router();

// GET /api/realtime/stream - SSE connection endpoint
realtimeRouter.get("/stream", (req, res) => {
  const token =
    (req.query.token as string | undefined) ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let user: RealtimeUser;
  try {
    const verified = verifyAuthToken(token);
    user = {
      id: verified.sub,
      role: verified.role,
      permissions: PERMISSIONS.filter((p) => hasPermission(verified.role, p)),
      tokenIssuedAt: verified.iat,
      tokenExpiresAt: verified.exp,
    };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const expeditionId = req.query.expeditionId as string | undefined;
  const clientId = crypto.randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client: RealtimeClient = {
    id: clientId,
    user,
    expeditions: new Set(expeditionId ? [expeditionId] : []),
    send: (event: string, data: unknown) => {
      res.write(`event: ${event}\nid: ${crypto.randomUUID()}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      unregisterRealtimeClient(clientId);
      res.end();
    },
  };

  registerRealtimeClient(client);

  res.write(`event: connect\ndata: ${JSON.stringify({ ok: true, clientId })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: "heartbeat"\n\n`);
    } catch {
      clearInterval(heartbeat);
      unregisterRealtimeClient(clientId);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterRealtimeClient(clientId);
  });
});

// POST /api/realtime/join - Join expedition room
realtimeRouter.post("/join", async (req, res) => {
  const { clientId, expeditionId } = (req.body as { clientId?: string; expeditionId?: string }) ?? {};
  if (!clientId || !expeditionId) {
    res.status(400).json({ ok: false, error: "clientId and expeditionId required" });
    return;
  }
  const result = await handleExpeditionJoin(clientId, expeditionId);
  res.status(result.ok ? 200 : 400).json(result);
});

// POST /api/realtime/leave - Leave expedition room
realtimeRouter.post("/leave", (req, res) => {
  const { clientId, expeditionId } = (req.body as { clientId?: string; expeditionId?: string }) ?? {};
  if (!clientId || !expeditionId) {
    res.status(400).json({ ok: false, error: "clientId and expeditionId required" });
    return;
  }
  const result = handleExpeditionLeave(clientId, expeditionId);
  res.status(result.ok ? 200 : 400).json(result);
});

export default realtimeRouter;

