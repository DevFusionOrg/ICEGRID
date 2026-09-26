import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { RealtimeProvider } from "./components/RealtimeProvider";

const queryClient = new QueryClient();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><RealtimeProvider><App /></RealtimeProvider></QueryClientProvider>
  </StrictMode>
);
