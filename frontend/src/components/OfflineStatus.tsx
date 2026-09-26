import { useOfflineSyncStore } from "../stores/offlineSync";
import { useRealtime } from "./RealtimeProvider";

export function OfflineStatus() {
  const { state, pending, failed, authenticationRequired, unassignedFailed } = useOfflineSyncStore();
  const { syncNow } = useRealtime();
  const label = state === "OFFLINE"
    ? `OFFLINE · ${pending} queued`
    : state === "SYNCING"
      ? `SYNCING · ${pending} queued`
      : state === "SERVER_UNREACHABLE"
        ? `SERVER UNREACHABLE · ${pending} queued`
        : state === "RETRY_SCHEDULED"
          ? `RETRY SCHEDULED · ${pending} queued`
        : state === "SYNC_ERROR"
          ? authenticationRequired > 0 ? `SIGN IN REQUIRED · ${authenticationRequired}` : `SYNC ERROR · ${failed} failed`
          : state === "SYNC_COMPLETE"
            ? "SYNC COMPLETE"
            : "ONLINE";

  return <div className="flex items-center gap-2 text-xs text-slate-500" role="status" aria-live="polite">
    <span className={`h-2 w-2 rounded-full ${state === "ONLINE" || state === "SYNC_COMPLETE" ? "bg-emerald-500" : state === "SYNCING" ? "bg-sky-500" : "bg-amber-500"}`} />
    <span>{label}</span>
    {failed > 0 && <button className="font-semibold text-sky-700 hover:underline" onClick={() => { void syncNow(true); }}>{authenticationRequired > 0 ? "Sign in, then retry" : "Retry failed"}</button>}
    {unassignedFailed > 0 && <span>Legacy queued items need review</span>}
  </div>;
}