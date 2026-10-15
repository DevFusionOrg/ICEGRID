import { FormEvent, useState } from "react";
import { ArrowRight, Lock, Mail, Snowflake, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../lib/api";
import { useAuthStore } from "../stores/auth";

interface LoginPageProps {
  initialMode?: "login" | "register";
}

export function LoginPage({ initialMode = "login" }: LoginPageProps) {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === "register");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const session = await login(loginEmail.trim(), loginPassword);
      setSession(session.token, session.user);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setLoginError(requestError instanceof Error ? requestError.message : "Unable to sign in");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");

    if (registerPassword.length < 8) {
      setRegisterError("Password must be at least 8 characters");
      setRegisterLoading(false);
      return;
    }

    try {
      const session = await register(registerEmail.trim(), registerPassword, registerName.trim());
      setSession(session.token, session.user);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setRegisterError(requestError instanceof Error ? requestError.message : "Unable to register");
    } finally {
      setRegisterLoading(false);
    }
  }

  function fillDemoAccount(email: string) {
    setLoginEmail(email);
    setLoginPassword("ChangeMe123!");
    setLoginError("");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-polar-900 px-4 py-8 font-sans">
      {/* Background ambient decorative shapes */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-arctic/20 blur-3xl" />

      {/* Main sliding container */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 md:min-h-[580px]">
        {/* Mobile View: Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 p-2 md:hidden">
          <button
            type="button"
            onClick={() => setIsRegisterMode(false)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              !isRegisterMode ? "bg-white text-polar-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterMode(true)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              isRegisterMode ? "bg-white text-polar-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Register
          </button>
        </div>

        {/* Desktop Container Grid */}
        <div className="grid min-h-[580px] grid-cols-1 md:grid-cols-2">
          {/* Sign In Panel */}
          <div
            className={`flex flex-col justify-center px-6 py-10 transition-all duration-500 md:px-12 ${
              isRegisterMode ? "hidden md:flex md:pointer-events-none md:opacity-0" : "flex md:opacity-100"
            }`}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Snowflake className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-polar-900">NCPOR ICEGRID</p>
                <p className="text-xs text-slate-500">Polar Operations Portal</p>
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-polar-900">Welcome Back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to coordinate polar expedition logistics and monitor active missions.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="name@ncpors.local"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="login-password">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {loginError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700" role="alert">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 active:scale-[0.99] disabled:opacity-60"
              >
                {loginLoading ? "Signing in..." : "Sign In to Dispatch"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Quick Demo Credentials */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Quick Fill Demo Roles:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: "Admin", email: "admin@ncpors.local" },
                  { label: "Coordinator", email: "coordinator@ncpors.local" },
                  { label: "Field", email: "field@ncpors.local" },
                  { label: "Logistics", email: "logistics@ncpors.local" },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => fillDemoAccount(demo.email)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-500 md:hidden">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegisterMode(true)}
                className="font-semibold text-sky-600 hover:underline"
              >
                Register here
              </button>
            </p>
          </div>

          {/* Sign Up / Register Panel */}
          <div
            className={`flex flex-col justify-center px-6 py-10 transition-all duration-500 md:px-12 ${
              !isRegisterMode ? "hidden md:flex md:pointer-events-none md:opacity-0" : "flex md:opacity-100"
            }`}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Snowflake className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-polar-900">NCPOR ICEGRID</p>
                <p className="text-xs text-slate-500">Personnel Registration</p>
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-polar-900">Create an Account</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Join the expedition personnel directory and connect to station operations.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleRegisterSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="register-name">
                  Full Name
                </label>
                <div className="relative mt-1.5">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    placeholder="Dr. Rajesh Sharma"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="register-email">
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="register-email"
                    type="email"
                    required
                    placeholder="scientist@ncpor.res.in"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="register-password">
                  Password (min 8 chars)
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="register-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {registerError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700" role="alert">
                  {registerError}
                </p>
              )}

              <button
                type="submit"
                disabled={registerLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 active:scale-[0.99] disabled:opacity-60"
              >
                {registerLoading ? "Creating account..." : "Complete Registration"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500 md:hidden">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegisterMode(false)}
                className="font-semibold text-sky-600 hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>

        {/* Desktop Sliding Overlay Panel */}
        <div
          className={`pointer-events-none absolute top-0 bottom-0 left-0 hidden w-1/2 flex-col justify-center bg-gradient-to-br from-sky-600 via-arctic to-polar-900 p-12 text-white shadow-2xl transition-transform duration-700 ease-in-out md:flex ${
            isRegisterMode ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-auto"
          }`}
        >
          {/* Subtle polar decorative element */}
          <div className="pointer-events-none absolute top-8 right-8 text-white/10">
            <Snowflake className="h-48 w-48 animate-pulse" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium tracking-wide text-sky-200 backdrop-blur-sm">
              <Snowflake className="h-3.5 w-3.5 text-sky-300" />
              NCPOR Mission Command
            </div>

            {isRegisterMode ? (
              <>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Welcome Back!</h2>
                <p className="mt-3 text-sm leading-relaxed text-sky-100/90">
                  Already registered in the polar logistics system? Access your station assignments, cargo consignments, and operational rosters.
                </p>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setLoginError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-polar-900 active:scale-95"
                  >
                    Switch to Sign In
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Hello, Explorer!</h2>
                <p className="mt-3 text-sm leading-relaxed text-sky-100/90">
                  New to the NCPOR expedition network? Create your profile to join polar field operations, track shipments, and coordinate Antarctic missions.
                </p>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setRegisterError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-polar-900 active:scale-95"
                  >
                    Create Field Account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer note inside overlay */}
          <div className="relative z-10 mt-auto pt-8 text-[11px] text-sky-200/60">
            National Centre for Polar and Ocean Research · Ministry of Earth Sciences, Govt. of India
          </div>
        </div>
      </div>
    </main>
  );
}

// Backwards-compatibility aliases
export const Login_page = LoginPage;
export default LoginPage;