type AuthAuditEvent = {
  action: "login.succeeded" | "login.failed" | "registration.succeeded" | "authorization.denied" | "user.provisioned";
  userId?: string;
  role?: string;
  permission?: string;
  method?: string;
  path?: string;
};

export function recordAuthAudit(event: AuthAuditEvent) {
  const level = event.action === "authorization.denied" || event.action === "login.failed" ? "warn" : "info";
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), category: "auth", ...event }));
}