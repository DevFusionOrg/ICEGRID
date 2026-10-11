import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Compass,
  Gauge,
  MapPinned,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

const capabilityCards = [
  {
    index: "01",
    tag: "EXPEDITIONS",
    tagClassName: "bg-sky-100 text-sky-700",
    title: "Expedition Planning & Management",
    description:
      "Plan and manage expeditions, coordinate assignments, and review mission readiness.",
    footer: [
      { label: "Mission planning", value: "Expedition records" },
      { label: "Readiness", value: "Operational checklist" },
    ],
  },
  {
    index: "02",
    tag: "PERSONNEL",
    tagClassName: "bg-emerald-100 text-emerald-700",
    title: "Personnel Accountability",
    description:
      "Manage personnel rosters, field roles, station assignments, and movement records.",
    footer: [
      { label: "Deployment", value: "Personnel assignments" },
      { label: "Movement", value: "Location records" },
    ],
  },
  {
    index: "03",
    tag: "CARGO TRACKING",
    tagClassName: "bg-sky-100 text-sky-700",
    title: "Supply Chain Consignment Tracking",
    description:
      "Follow cargo consignments through multimodal transit stages with shipment tracking.",
    footer: [
      { label: "Transport", value: "Transit stages" },
      { label: "Shipment", value: "Milestone tracking" },
    ],
  },
  {
    index: "04",
    tag: "INVENTORY",
    tagClassName: "bg-sky-100 text-sky-700",
    title: "Inventory & Resupply",
    description:
      "Track inventory items with SKU, priority, condition, and reorder information.",
    footer: [
      { label: "Item records", value: "SKU and condition" },
      { label: "Resupply", value: "Reorder alerts" },
    ],
  },
  {
    index: "05",
    tag: "EMERGENCY RESPONSE",
    tagClassName: "bg-amber-100 text-amber-700",
    title: "Emergency Coordination",
    description:
      "Broadcast and manage emergency alerts with severity and personnel safety tracking.",
    footer: [
      { label: "Alerts", value: "Severity levels" },
      { label: "Response", value: "Personnel safety" },
    ],
  },
  {
    index: "06",
    tag: "OFFLINE-FIRST",
    tagClassName: "bg-sky-100 text-sky-700",
    title: "Remote Operations Support",
    description:
      "Use local application data in remote settings and synchronize queued changes when connectivity returns.",
    footer: [
      { label: "Local storage", value: "IndexedDB" },
      { label: "Synchronization", value: "Queued resync" },
    ],
  },
];

const architectureItems = [
  { title: "Offline-first access", value: "Local data and queued changes", icon: ShieldCheck },
  { title: "Data synchronization", value: "Queued updates resync when connected", icon: Gauge },
  { title: "Realtime updates", value: "Cargo, location, and emergency events", icon: RadioTower },
  { title: "Polar GIS maps", value: "Antarctic station mapping", icon: MapPinned },
];

const platformAreas = [
  {
    label: "01 / EXPEDITION OPERATIONS",
    title: "Plan and coordinate missions",
    description:
      "Expedition planning and management with coordinator and personnel assignments, plus readiness information.",
    icon: Compass,
  },
  {
    label: "02 / LOGISTICS AND SUPPLY CHAIN",
    title: "Track cargo and supplies",
    description:
      "Cargo management across shipment milestones and transport stages, alongside inventory and resupply workflows.",
    icon: PackageCheck,
  },
  {
    label: "03 / PERSONNEL AND EMERGENCY RESPONSE",
    title: "Account for teams in the field",
    description:
      "Personnel deployment and accountability, location history where supported, emergency coordination, and audit trails.",
    icon: Users,
  },
];

function BrandMark() {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <div
        className="absolute inset-0 border border-sky-300/80 bg-sky-100/90 shadow-inner shadow-white/80"
        style={{ clipPath: "polygon(25% 6%, 75% 6%, 96% 50%, 75% 94%, 25% 94%, 4% 50%)" }}
      />
      <div
        className="absolute inset-[7px] border border-sky-600/60 bg-white/40"
        style={{ clipPath: "polygon(25% 6%, 75% 6%, 96% 50%, 75% 94%, 25% 94%, 4% 50%)" }}
      />
      <div className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full bg-sky-700" />
      <div className="absolute h-5 w-5 rotate-90 border border-sky-700/60" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const handleCommandCenter = () => {
    navigate(token ? "/dashboard" : "/login");
  };

  return (
    <div className="min-h-screen bg-[#f4f8fb] text-slate-700">
      <div className="border-b border-sky-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden px-4 py-2 text-[0.62rem] font-medium uppercase tracking-[0.24em] text-slate-600 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
            ICEGRID PLATFORM
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-5 overflow-hidden whitespace-nowrap text-slate-500">
            <span>Expedition operations</span>
            <span className="text-sky-700">•</span>
            <span>Logistics and supply chain</span>
            <span className="text-sky-700">•</span>
            <span>Personnel and emergency response</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-sky-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[0.7rem] font-black uppercase tracking-[0.36em] text-slate-900">ICEGRID</p>
              <p className="text-[0.58rem] uppercase tracking-[0.24em] text-slate-500">Polar operations</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#capabilities" className="transition hover:text-sky-700">Capabilities</a>
            <a href="#telemetry" className="transition hover:text-sky-700">Platform scope</a>
            <a href="#architecture" className="transition hover:text-sky-700">Architecture</a>
            <a href="#dispatch-login" className="transition hover:text-sky-700">Dispatch</a>
          </nav>

          <button
            type="button"
            onClick={handleCommandCenter}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-200"
          >
            <span>Command Center</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[700px] overflow-hidden border-b border-sky-100 bg-[#edf7fb]">
          <div className="absolute inset-0 z-0">
            <img
              src="/icegrid-antarctic-hero.jpg"
              alt="Antarctic scientific expedition base at dusk"
              className="h-full w-full object-cover object-[center_32%] opacity-100"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(237,247,251,0.8),rgba(237,247,251,0.62),rgba(237,247,251,0.42))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_32%)]" />
          </div>

          <div className="relative z-20 mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
            <div className="max-w-[1080px] py-7 sm:py-8 lg:pb-10 lg:pt-10">
              <div className="mb-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-sky-200 bg-white/75 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sky-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span>Antarctic Continental Ops</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">Expedition logistics platform</span>
              </div>

              <h1 className="max-w-[1080px] break-normal text-[clamp(2.5rem,7vw,3.5rem)] font-black leading-[1.04] tracking-[-0.045em] text-slate-900 sm:text-[clamp(3rem,6vw,3.75rem)] lg:text-[clamp(4rem,5.1vw,4.75rem)]">
                Humanity&apos;s Command Window at the <span className="text-sky-700 underline decoration-sky-200 decoration-wavy underline-offset-[10px]">Edge of the World.</span>
              </h1>

              <p className="mt-5 max-w-[820px] text-base leading-relaxed text-slate-700 sm:text-lg lg:text-xl">
                Connecting isolated field teams, tracked traverse convoys, cryogenic ice-core freight, and emergency life-safety across 14 million square kilometers of Antarctic ice.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={handleCommandCenter}
                  className="glove-btn inline-flex items-center justify-center rounded-xl bg-sky-700 px-7 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-sky-800"
                >
                  <span>Access Command Center</span>
                  <ArrowRight className="ml-2.5 h-5 w-5" />
                </button>

                <a
                  href="#capabilities"
                  className="glove-btn inline-flex items-center justify-center rounded-xl border border-sky-200 bg-white/90 px-7 py-3.5 text-base font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  Explore Platform Dossier
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-mono text-slate-600">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-sky-700" />
                  <span>Expedition planning</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-sky-700" />
                  <span>Cargo &amp; inventory tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-sky-700" />
                  <span>Personnel accountability</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-sky-100 bg-white/75 px-4 py-3 text-xs text-slate-600 shadow-sm">
              <span className="font-mono uppercase tracking-[0.12em] text-sky-800">Platform overview</span>
              <span className="ml-3">Capabilities summary · Not a live operational feed</span>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-b border-sky-100 bg-[#f7fbff] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-sky-700">
                <span>ICEGRID CAPABILITIES OVERVIEW</span>
                <span>•</span>
                <span className="text-slate-500">SYSTEM MATRIX</span>
              </div>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-4xl">
                Six Critical Disciplines Engineered for the Polar Plateau.
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Extreme sub-zero operation requires specialized telemetry architecture designed around severe whiteouts, volatile crevasses, and sparse L-band satellite connectivity.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {capabilityCards.map((card) => (
                <article key={card.index} className="polar-glass-card flex min-h-[320px] flex-col justify-between rounded-xl p-6">
                  <div>
                    <div className="mb-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span className="text-sm font-bold text-sky-700">{card.index}</span>
                      <span className={`rounded px-2 py-0.5 font-medium ${card.tagClassName}`}>{card.tag}</span>
                    </div>
                    <h3 className="mb-3 text-2xl font-bold tracking-[-0.03em] text-slate-900">{card.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{card.description}</p>
                  </div>

                  <div className="mt-6 space-y-2 rounded-b-xl border-t border-sky-100 bg-slate-50/80 p-4 font-mono text-[11px] text-slate-600">
                    {card.footer.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4">
                        <span>{item.label}:</span>
                        <span className="font-bold text-slate-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="telemetry" className="border-b border-sky-100 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 max-w-3xl">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-sky-700">ICEGRID / PLATFORM SCOPE</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                Integrated Polar Expedition Operations
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                A summary of platform capabilities, not a display of live operational data.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {platformAreas.map(({ label, title, description, icon: Icon }) => (
                <article key={label} className="polar-glass-card flex min-h-[220px] flex-col rounded-xl p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-sky-800">{label}</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="architecture" className="border-t border-sky-100 bg-[#edf7fb] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr]">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-sky-700">Offline & satellite architecture</p>
                <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-4xl">
                  Designed for isolated operations when the ice is the only network.
                </h3>
                <p className="mt-4 max-w-xl text-lg text-slate-600">
                  ICEGRID is built for polar leadership, field survival, and cold-chain accountability under sparse connectivity and latency-sensitive emergency response conditions.
                </p>

                <div className="mt-8 space-y-4">
                  {architectureItems.map(({ title, value, icon: Icon }) => (
                    <div key={title} className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-white/80 p-4 shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-xs font-mono uppercase tracking-[0.12em] text-slate-500">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-sky-100 bg-white p-6 shadow-lg">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Offline-first design</p>
                    <h4 className="mt-2 text-2xl font-bold text-slate-900">Field-ready data workflows</h4>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  ICEGRID supports local use in remote settings with queued changes that can synchronize when connectivity is available. Realtime updates are available for supported cargo, location, and emergency events.
                </p>
                <div className="mt-5 space-y-3 rounded-xl border border-sky-100 bg-slate-50/80 p-4">
                  {architectureItems.slice(0, 3).map(({ title, value, icon: Icon }) => (
                    <div key={title} className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{title}</p>
                        <p className="text-xs text-slate-500">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="dispatch-login" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] border border-sky-100 bg-[radial-gradient(circle_at_top,_rgba(154,212,244,0.35),_rgba(255,255,255,0.95)_48%)] p-8 shadow-lg sm:p-10">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-sky-700">Dispatch terminal</p>
                  <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-4xl">
                    Coordinate field logistics, cargo flow, and emergency response in one polar-ready workspace.
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCommandCenter}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-sky-800"
                  >
                    <span>Open Command Center</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <a href="/login" className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-6 py-3.5 text-base font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50">
                    Sign in to dispatch
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sky-100 bg-[#f3f8fb] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-900">ICEGRID</p>
              <p className="text-[0.58rem] uppercase tracking-[0.18em] text-slate-500">Polar operations platform</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <a href="#capabilities" className="transition hover:text-sky-700">Capabilities</a>
            <a href="#telemetry" className="transition hover:text-sky-700">Platform scope</a>
            <a href="#architecture" className="transition hover:text-sky-700">Architecture</a>
            <a href="#dispatch-login" className="transition hover:text-sky-700">Dispatch</a>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono uppercase tracking-[0.18em] text-slate-500">
            <span className="flex items-center gap-2"><Compass className="h-4 w-4 text-sky-700" /> Antarctica</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-700" /> Mission teams</span>
            <span className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-sky-700" /> Logistics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
