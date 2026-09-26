import { create } from "zustand";

export type OfflineSyncState = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNC_COMPLETE" | "RETRY_SCHEDULED" | "SYNC_ERROR" | "SERVER_UNREACHABLE";

type OfflineSyncStatus = {
  state: OfflineSyncState;
  pending: number;
  failed: number;
  authenticationRequired: number;
  unassignedFailed: number;
  setStatus: (state: OfflineSyncState, counts?: { pending: number; failed: number; authenticationRequired: number; unassignedFailed: number }) => void;
};

export const useOfflineSyncStore = create<OfflineSyncStatus>((set) => ({
  state: navigator.onLine ? "ONLINE" : "OFFLINE",
  pending: 0,
  failed: 0,
  authenticationRequired: 0,
  unassignedFailed: 0,
  setStatus: (state, counts) => set((current) => ({ state, ...(counts ?? current) })),
}));