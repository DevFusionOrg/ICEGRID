import { FormEvent, useState } from "react";
import { Snowflake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/api";
import { useAuthStore } from "../stores/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await login(email, password);
      setSession(session.token, session.user);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-polar-900 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Snowflake className="h-8 w-8 text-sky-600" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-polar-900">NCPOR</p>
            <p className="text-xs text-slate-500">Polar logistics platform</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-polar-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to coordinate your expedition operations.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-sky-500 focus:ring-2" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-sky-500 focus:ring-2" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
