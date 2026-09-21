import { Compass, Map, Package, Snowflake } from "lucide-react";

const capabilities = [
  { icon: Map, title: "Expedition planning", text: "Coordinate routes, vessels, aircraft, and field teams." },
  { icon: Package, title: "Cargo visibility", text: "Track scientific equipment and essential supplies end to end." },
  { icon: Compass, title: "Mission readiness", text: "Keep every deployment aligned with polar conditions and timelines." }
];

export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-polar-50 via-white to-slate-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-12">
        <div className="mb-12 flex items-center gap-3 text-polar-900">
          <Snowflake className="h-8 w-8 text-sky-600" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-[0.25em]">NCPOR</span>
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Polar expedition logistics</p>
          <h1 className="text-4xl font-bold tracking-tight text-polar-900 sm:text-6xl">
            Reliable coordination for India&apos;s polar missions.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            NCPOR&apos;s expedition logistics platform brings planning, cargo, crews, and mission operations into one clear view.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <Icon className="h-6 w-6 text-sky-600" aria-hidden="true" />
              <h2 className="mt-5 text-lg font-semibold text-polar-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
