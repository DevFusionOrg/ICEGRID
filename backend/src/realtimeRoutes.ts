import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
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

const realtimeRoutes = new Hono();

// GET /api/realtime/stream  — open an SSE connection
realtimeRoutes.get("/stream", async (c) => {
  const authHeader = c.req.header("authorization");
  const token =
    c.req.query("token") ??
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!token) return c.json({ error: "Authentication required" }, 401);

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
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const expeditionId = c.req.query("expeditionId");
  const clientId = crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    const client: RealtimeClient = {
      id: clientId,
      user,
      expeditions: new Set(expeditionId ? [expeditionId] : []),
      send: (event: string, data: unknown) => {
        void stream.writeSSE({
          event,
          data: JSON.stringify(data),
          id: crypto.randomUUID(),
        });
      },
      close: () => {
        unregisterRealtimeClient(clientId);
      },
    };

    registerRealtimeClient(client);

    await stream.writeSSE({
      event: "connect",
      data: JSON.stringify({ ok: true, clientId }),
    });

    stream.onAbort(() => {
      unregisterRealtimeClient(clientId);
    });

    // Keep-alive heartbeat every 15 s
    while (true) {
      await stream.sleep(15_000);
      try {
        await stream.writeSSE({ event: "ping", data: "heartbeat" });
      } catch {
        break;
      }
    }

    unregisterRealtimeClient(clientId);
  });
});

// POST /api/realtime/join  — join an expedition room
realtimeRoutes.post("/join", async (c) => {
  let clientId: string | undefined;
  let expeditionId: string | undefined;
  try {
    const body = await c.req.json<{ clientId?: string; expeditionId?: string }>();
    clientId = body.clientId;
    expeditionId = body.expeditionId;
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!clientId || !expeditionId) {
    return c.json({ ok: false, error: "clientId and expeditionId required" }, 400);
  }

  const result = await handleExpeditionJoin(clientId, expeditionId);
  return c.json(result, result.ok ? 200 : 400);
});

// POST /api/realtime/leave  — leave an expedition room
realtimeRoutes.post("/leave", async (c) => {
  let clientId: string | undefined;
  let expeditionId: string | undefined;
  try {
    const body = await c.req.json<{ clientId?: string; expeditionId?: string }>();
    clientId = body.clientId;
    expeditionId = body.expeditionId;
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!clientId || !expeditionId) {
    return c.json({ ok: false, error: "clientId and expeditionId required" }, 400);
  }

  const result = handleExpeditionLeave(clientId, expeditionId);
  return c.json(result, result.ok ? 200 : 400);
});

export default realtimeRoutes;
