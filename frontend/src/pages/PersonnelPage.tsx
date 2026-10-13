import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  MapPinned,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Expedition,
  Personnel,
  PersonnelRole,
  PersonnelStatus,
  PERSONNEL_ROLES,
  PERSONNEL_STATUSES,
  createPersonnel,
  deletePersonnel,
  getCollection,
  updatePersonnel,
} from "../lib/api";
import { PolarMap } from "../components/PolarMap";
import { POLAR_REGION_DEFINITIONS } from "../lib/polarMapConfig";
import { PERSONNEL_STATUS_COLORS, createPersonnelPolarMarkers } from "../lib/polarMapPageMarkers";
import { useAuthStore } from "../stores/auth";
import { useExpeditionRoom } from "../components/RealtimeProvider";

type PersonnelFormState = {
  firstName: string;
  lastName: string;
  expeditionId: string;
  role: PersonnelRole;
  status: PersonnelStatus;
  email: string;
  phone: string;
  organization: string;
  emergencyContact: string;
};

const emptyForm: PersonnelFormState = {
  firstName: "",
  lastName: "",
  expeditionId: "",
  role: "MEMBER",
  status: "ASSIGNED",
  email: "",
  phone: "",
  organization: "",
  emergencyContact: "",
};

export function PersonnelPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const canManage = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [expedition, setExpedition] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [page, setPage] = useState(1);

  // Map state
  const [region, setRegion] = useState<"antarctic" | "arctic">("antarctic");
  const [plottedPersonnelCount, setPlottedPersonnelCount] = useState(0);

  // Form & Modal states
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [form, setForm] = useState<PersonnelFormState>(emptyForm);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Personnel | null>(null);

  // Realtime room subscription for selected expedition
  useExpeditionRoom(expedition !== "ALL" && expedition ? expedition : null);

  // Query parameters
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("pageSize", "20");
  if (expedition && expedition !== "ALL") queryParams.set("expeditionId", expedition);
  if (status && status !== "ALL") queryParams.set("status", status);
  if (role && role !== "ALL") queryParams.set("role", role);
  if (search.trim()) queryParams.set("q", search.trim());
  const queryString = queryParams.toString();

  const personnel = useQuery({
    queryKey: ["personnel", "roster", { page, expedition, status, role, search: search.trim() }],
    queryFn: () => getCollection<Personnel>(`/personnel?${queryString}`, token!),
    enabled: Boolean(token),
  });

  const expeditions = useQuery({
    queryKey: ["personnel", "expeditions"],
    queryFn: () => getCollection<Expedition>("/expeditions?pageSize=100", token!),
    enabled: Boolean(token),
  });

  const expeditionNames = useMemo(
    () => new Map(expeditions.data?.data.map((item) => [item.id, item.name])),
    [expeditions.data],
  );

  const roster = personnel.data?.data ?? [];
  const pagination = personnel.data?.pagination;
  const total = pagination?.total ?? roster.length;
  const totalPages = pagination?.totalPages ?? 1;

  const personnelMarkers = useMemo(() => createPersonnelPolarMarkers(roster), [roster]);

  const invalidateData = () => {
    void queryClient.invalidateQueries({ queryKey: ["personnel"] });
    void queryClient.invalidateQueries({ queryKey: ["expeditions"] });
    void queryClient.invalidateQueries({ queryKey: ["expedition"] });
    void queryClient.invalidateQueries({ queryKey: ["expedition-readiness"] });
  };

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      firstName: editing.firstName,
      lastName: editing.lastName,
      expeditionId: editing.expeditionId ?? "",
      role: editing.role || "MEMBER",
      status: editing.status || "ASSIGNED",
      email: editing.email ?? "",
      phone: editing.phone ?? "",
      organization: editing.organization ?? "",
      emergencyContact: editing.emergencyContact ?? "",
    });
  }, [editing]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        expeditionId: form.expeditionId ? form.expeditionId : null,
        role: form.role,
        status: form.status,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        organization: form.organization.trim() || null,
        emergencyContact: form.emergencyContact.trim() || null,
      };
      return editing
        ? updatePersonnel(token!, editing.id, payload)
        : createPersonnel(token!, payload);
    },
    onSuccess: (data) => {
      const isUpdate = Boolean(editing);
      setEditing(null);
      setForm(emptyForm);
      if (isUpdate && (data as { leadCleared?: boolean } | undefined)?.leadCleared) {
        setActionNotice("Personnel record updated. The previous expedition no longer has a designated lead.");
      } else {
        setActionNotice(isUpdate ? "Personnel record updated successfully." : "Personnel record created successfully.");
      }
      invalidateData();
    },
    onError: (err: Error) => {
      setActionNotice(`Error: ${err.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePersonnel(token!, id),
    onSuccess: () => {
      if (editing?.id === deletingPerson?.id) {
        setEditing(null);
        setForm(emptyForm);
      }
      setDeletingPerson(null);
      setActionNotice("Personnel record deleted successfully.");
      invalidateData();
    },
    onError: (err: Error) => {
      setActionNotice(`Delete failed: ${err.message}`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Field operations</p>
        <h2 className="mt-2 text-3xl font-bold">Personnel roster</h2>
        <p className="mt-2 text-sm text-slate-500">Current status and last-known field positions.</p>
      </div>

      {actionNotice && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm border ${
            actionNotice.startsWith("Error:") || actionNotice.startsWith("Delete failed:")
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-sky-50 border-sky-200 text-sky-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.startsWith("Error:") || actionNotice.startsWith("Delete failed:") ? (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
            )}
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-500 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search personnel by name or email..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={expedition}
            onChange={(e) => {
              setExpedition(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All expeditions</option>
            {expeditions.data?.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All roles</option>
            {PERSONNEL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All statuses</option>
            {PERSONNEL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left side Table + PolarMap, Right side Create/Edit Form (when canManage) */}
      <div className={`grid gap-6 ${canManage ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)_420px]"}`}>
        <div className="space-y-6">
          {/* Table Section */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4 text-sky-600" />
                <span>{total} personnel</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Expedition</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Last known location</th>
                    {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((person) => (
                    <tr key={person.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {person.firstName} {person.lastName}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{person.role}</td>
                      <td className="px-5 py-4">
                        <span
                          className="rounded-full px-2 py-1 text-xs font-semibold"
                          style={{
                            color: PERSONNEL_STATUS_COLORS[person.status] ?? "#475569",
                            backgroundColor: `${PERSONNEL_STATUS_COLORS[person.status] ?? "#475569"}18`,
                          }}
                        >
                          {person.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {person.expeditionId ? (expeditionNames.get(person.expeditionId) ?? "—") : "None (Unassigned)"}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{person.email || "—"}</td>
                      <td className="px-5 py-4 text-slate-500">{person.organization || "—"}</td>
                      <td className="px-5 py-4 text-slate-500">
                        {person.lastKnownLocation ?? "Not reported"}
                      </td>
                      {canManage && (
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            className="text-sky-700 hover:text-sky-900 transition mr-2"
                            title="Edit personnel"
                            onClick={() => setEditing(person)}
                          >
                            <Edit3 className="h-4 w-4 inline" />
                          </button>
                          <button
                            type="button"
                            className="text-rose-600 hover:text-rose-800 transition"
                            title="Delete personnel"
                            onClick={() => setDeletingPerson(person)}
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {roster.length === 0 && (
              <p className="p-10 text-center text-sm text-slate-500">No personnel records found.</p>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span>Showing {roster.length} of {total} personnel</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  Previous
                </button>
                <span className="font-medium text-slate-700">
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          {/* PolarMap Section */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <MapPinned className="h-4 w-4 text-sky-600" />
                Last-known locations ({plottedPersonnelCount} plotted)
              </h3>
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                value={region}
                onChange={(event) => setRegion(event.target.value as "antarctic" | "arctic")}
              >
                <option value="antarctic">{POLAR_REGION_DEFINITIONS.antarctic.label}</option>
                <option value="arctic">{POLAR_REGION_DEFINITIONS.arctic.label}</option>
              </select>
            </div>
            <div className="h-[480px] bg-slate-100">
              <PolarMap
                markers={personnelMarkers}
                region={region}
                onMarkerCountChange={setPlottedPersonnelCount}
              />
            </div>
            <p className="px-5 py-3 text-xs text-slate-400">
              Only personnel with valid latitude,longitude coordinates are plotted.
            </p>
          </section>
        </div>

        {/* Side Create/Edit Form (only when canManage is true) */}
        {canManage && (
          <div>
            <section className="sticky top-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <UserPlus className="h-4 w-4 text-sky-600" />
                {editing ? "Edit personnel" : "Add personnel"}
              </h3>
              <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      First name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="First name"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Last name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Last name"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">
                    Expedition
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={form.expeditionId}
                    onChange={(e) => setForm({ ...form, expeditionId: e.target.value })}
                  >
                    <option value="">
                      None (Unassigned)
                    </option>
                    {expeditions.data?.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Role</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as PersonnelRole })}
                    >
                      {PERSONNEL_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Status</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      value={form.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as PersonnelStatus;
                        setForm((prev) => ({
                          ...prev,
                          status: newStatus,
                          expeditionId: newStatus === "RETURNED" ? "" : prev.expeditionId,
                        }));
                      }}
                    >
                      {PERSONNEL_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="name@organization.org"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="+1 (555) 012-3456"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Organization</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Research Institute / Org"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Emergency Contact</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Contact name and phone"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={save.isPending}
                    className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition"
                  >
                    {save.isPending ? "Saving..." : editing ? "Save changes" : "Add personnel"}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setForm(emptyForm);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Delete Personnel Record?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong>{deletingPerson.firstName} {deletingPerson.lastName}</strong>?
            </p>
            {deletingPerson.role === "LEAD" && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Notice:</strong> This person is designated as an expedition lead. Deleting this record will clear the expedition lead assignment.
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDeletingPerson(null)}
                disabled={remove.isPending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(deletingPerson.id)}
                disabled={remove.isPending}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {remove.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
