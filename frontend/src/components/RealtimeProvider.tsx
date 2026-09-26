import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { realtimeSocketManager, type ICEGRIDSocket } from "../lib/realtimeClient";

export type RealtimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

type RealtimeContextValue = {
  socket: ICEGRIDSocket | null;
  status: RealtimeStatus;
  subscribeToExpedition: (expeditionId: string) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<ICEGRIDSocket | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>(token ? "connecting" : "disconnected");
  const roomReferences = useRef(new Map<string, number>());

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

  return <RealtimeContext.Provider value={{ socket, status, subscribeToExpedition }}>{children}</RealtimeContext.Provider>;
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