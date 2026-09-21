import { create } from "zustand";
import type { Role, User } from "../lib/api";

type AuthState = {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
};

const stored = localStorage.getItem("ncpors-auth");
const initial = stored ? (JSON.parse(stored) as Pick<AuthState, "token" | "user">) : { token: null, user: null };

export const useAuthStore = create<AuthState>((set) => ({
  ...initial,
  setSession: (token, user) => {
    localStorage.setItem("ncpors-auth", JSON.stringify({ token, user }));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("ncpors-auth");
    set({ token: null, user: null });
  },
}));

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrator",
  COORDINATOR: "Coordinator",
  FIELD_PERSONNEL: "Field Personnel",
  LOGISTICS_OFFICER: "Logistics Officer",
};
