import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { syncOfflineQueue } from "./lib/offlineSync";
import { RealtimeProvider } from "./components/RealtimeProvider";

const queryClient = new QueryClient();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
}
window.addEventListener("online", () => { void syncOfflineQueue(); });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><RealtimeProvider><App /></RealtimeProvider></QueryClientProvider>
  </StrictMode>
);
