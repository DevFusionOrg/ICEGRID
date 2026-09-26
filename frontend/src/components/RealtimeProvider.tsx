import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { realtimeSocketManager, type ICEGRIDSocket } from "../lib/realtimeClient";
import { queueCounts } from "../lib/offlineQueue";
import { registerOfflineSyncTrigger, retryFailedOfflineQueue, syncOfflineQueue } from "../lib/offlineSync";
import { useOfflineSyncStore } from "../stores/offlineSync";

export type RealtimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

type RealtimeContextValue = {
  socket: ICEGRIDSocket | null;
  status: RealtimeStatus;
  subscribeToExpedition: (expeditionId: string) => () => void;
  syncNow: (retryFailed?: boolean) => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<ICEGRIDSocket | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>(token ? "connecting" : "disconnected");
  const roomReferences = useRef(new Map<string, number>());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setOfflineStatus = useOfflineSyncStore((state) => state.setStatus);

  const syncNow = useCallback(async (retryFailed = false) => {
    if (!token || !user) return;
    const counts = await queueCounts(user.id);
    if (!navigator.onLine) {
      setOfflineStatus("OFFLINE", counts);
      return;
    }
    if (counts.pending === 0 && counts.failed === 0) {
      setOfflineStatus(counts.unassignedFailed ? "SYNC_ERROR" : "ONLINE", counts);
      return;
    }

    setOfflineStatus("SYNCING", counts);
    try {
      const result = retryFailed
        ? await retryFailedOfflineQueue(user.id, token)
        : await syncOfflineQueue(user.id, token);
      void queryClient.invalidateQueries({ queryKey: ["cargo"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["personnel"] });
      setOfflineStatus(
        result.networkUnavailable ? "SERVER_UNREACHABLE" : result.failed || result.unassignedFailed ? "SYNC_ERROR" : result.nextRetryAt !== null ? "RETRY_SCHEDULED" : result.syncedThisRun ? "SYNC_COMPLETE" : "ONLINE",
        result,
      );
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (result.nextRetryAt !== null && result.pending > 0) {
        retryTimer.current = setTimeout(() => { void syncNow(); }, Math.max(0, result.nextRetryAt - Date.now()));
      }
    } catch {
      setOfflineStatus("SERVER_UNREACHABLE", await queueCounts(user.id));
    }
  }, [queryClient, setOfflineStatus, token, user]);

  useEffect(() => {
    if (!token) {
      realtimeSocketManager.disconnect();
      setSocket(null);
      setStatus("disconnected");
      return;
    }

    const connection = realtimeSocketManager.get(token);
    setSocket(connection);
    setStatus(connection.connected ? "connected" : "connecting");
    const joinReferencedRooms = () => {
      for (const expeditionId of roomReferences.current.keys()) {
        connection.emit("expedition:join", { expeditionId });
      }
    };
    const handleConnect = () => {
      setStatus("connected");
      joinReferencedRooms();
      void queryClient.invalidateQueries();
    };
    const handleDisconnect = () => setStatus("reconnecting");
    const handleConnectError = () => setStatus("error");
    const invalidateCargo = () => { void queryClient.invalidateQueries({ queryKey: ["cargo"] }); };
    const invalidateAlerts = () => { void queryClient.invalidateQueries({ queryKey: ["alerts"] }); };
    const invalidateLocation = (update: { entityType: "personnel" | "cargo" | "emergency" }) => {
      const queryKey = update.entityType === "personnel" ? ["personnel"] : update.entityType === "cargo" ? ["cargo"] : ["alerts"];
      void queryClient.invalidateQueries({ queryKey });
    };

    connection.on("connect", handleConnect);
    connection.on("disconnect", handleDisconnect);
    connection.on("connect_error", handleConnectError);
    connection.on("cargo.updated", invalidateCargo);
    connection.on("location.updated", invalidateLocation);
    connection.on("emergency.created", invalidateAlerts);
    connection.on("alert:new", invalidateAlerts);
    if (connection.connected) handleConnect();

    return () => {
      connection.off("connect", handleConnect);
      connection.off("disconnect", handleDisconnect);
      connection.off("connect_error", handleConnectError);
      connection.off("cargo.updated", invalidateCargo);
      connection.off("location.updated", invalidateLocation);
      connection.off("emergency.created", invalidateAlerts);
      connection.off("alert:new", invalidateAlerts);
      realtimeSocketManager.disconnect(connection);
    };
  }, [queryClient, token]);

  useEffect(() => {
    if (!token || !user) {
      registerOfflineSyncTrigger(null);
      return;
    }
    const trigger = () => { void syncNow(); };
    const handleOffline = () => { void queueCounts(user.id).then((counts) => setOfflineStatus("OFFLINE", counts)); };
    const handleQueueChanged = () => {
      if (navigator.onLine) trigger();
      else handleOffline();
    };
    registerOfflineSyncTrigger(trigger);
    window.addEventListener("online", trigger);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ncpors:offline-queue-changed", handleQueueChanged);
    socket?.on("connect", trigger);
    trigger();
    return () => {
      registerOfflineSyncTrigger(null);
      window.removeEventListener("online", trigger);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ncpors:offline-queue-changed", handleQueueChanged);
      socket?.off("connect", trigger);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [setOfflineStatus, socket, syncNow, token, user]);

  const subscribeToExpedition = useCallback((expeditionId: string) => {
    const referenceCount = roomReferences.current.get(expeditionId) ?? 0;
    roomReferences.current.set(expeditionId, referenceCount + 1);
    if (referenceCount === 0 && socket?.connected) socket.emit("expedition:join", { expeditionId });

    return () => {
      const currentCount = roomReferences.current.get(expeditionId) ?? 0;
      if (currentCount <= 1) {
        roomReferences.current.delete(expeditionId);
        if (socket?.connected) socket.emit("expedition:leave", { expeditionId });
      } else {
        roomReferences.current.set(expeditionId, currentCount - 1);
      }
    };
  }, [socket]);

  return <RealtimeContext.Provider value={{ socket, status, subscribeToExpedition, syncNow }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used inside RealtimeProvider");
  return value;
}

export function useExpeditionRoom(expeditionId: string | null) {
  const subscribe = useRealtime().subscribeToExpedition;
  useEffect(() => expeditionId ? subscribe(expeditionId) : undefined, [expeditionId, subscribe]);
}