import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Filter,
  Flame,
  Layers,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Edit,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  CargoItem,
  Expedition,
  ExpeditionReadinessResult,
  Personnel,
  createCargoItem,
  createExpedition,
  createPersonnel,
  deleteExpedition,
  generateExpeditionCode,
  getCollection,
  getExpedition,
  getExpeditionReadiness,
  getUsers,
  updateExpedition,
  validateExpeditionCode,
} from "../lib/api";
import { useAuthStore } from "../stores/auth";

const STANDARD_DESTINATIONS = [
  "Maitri Station (Antarctica)",
  "Bharati Station (Antarctica)",
  "Dakshin Gangotri (Antarctica)",
  "Himadri Station (Ny-Ålesund, Arctic)",
  "IndARC Observatory (Kongsfjorden)",
  "Larsemann Hills Field Camp",
  "Schirmacher Oasis",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; bgClass: string; borderClass: string }
> = {
  PLANNED: {
    label: "PLANNED",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    bgClass: "bg-sky-500",
    borderClass: "border-sky-300",
  },
  ACTIVE: {
    label: "ACTIVE",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-300",
  },
  COMPLETED: {
    label: "COMPLETED",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    bgClass: "bg-slate-500",
    borderClass: "border-slate-300",
  },
  CANCELLED: {
    label: "CANCELLED",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    bgClass: "bg-rose-500",
    borderClass: "border-rose-300",
  },
};

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not scheduled";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Not scheduled";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function calculateDurationDays(startStr: string | null, endStr: string | null): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function PlanningPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const canManage = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selection & Modal states
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  // Form states (Create & Edit)
  const [editId, setEditId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDestination, setFormDestination] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStatus, setFormStatus] = useState<"PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED">("PLANNED");
  const [formCoordinatorId, setFormCoordinatorId] = useState("");
  const [formCoordinatorName, setFormCoordinatorName] = useState("");
  const [formLeadScientistId, setFormLeadScientistId] = useState("");

  // Code validation state
  const [codeFeedback, setCodeFeedback] = useState<{ valid: boolean; message: string } | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);

  // Quick Assignment states
  const [personnelName, setPersonnelName] = useState("");
  const [personnelRole, setPersonnelRole] = useState("MEMBER");
  const [cargoName, setCargoName] = useState("");
  const [cargoCategory, setCargoCategory] = useState("General Cargo");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Queries
  const expeditionsQuery = useQuery({
    queryKey: ["expeditions", statusFilter],
    queryFn: () => {
      const url = statusFilter === "ALL" ? "/expeditions?pageSize=100" : `/expeditions?pageSize=100&status=${statusFilter}`;
      return getCollection<Expedition>(url, token!);
    },
    enabled: Boolean(token),
  });

  const selectedExpeditionQuery = useQuery({
    queryKey: ["expedition", selectedExpeditionId],
    queryFn: () => getExpedition(token!, selectedExpeditionId!),
    enabled: Boolean(token && selectedExpeditionId),
  });

  const readinessQuery = useQuery({
    queryKey: ["expedition-readiness", selectedExpeditionId],
    queryFn: () => getExpeditionReadiness(token!, selectedExpeditionId!),
    enabled: Boolean(token && selectedExpeditionId),
  });

  const personnelQuery = useQuery({
    queryKey: ["personnel"],
    queryFn: () => getCollection<Personnel>("/personnel?pageSize=200", token!),
    enabled: Boolean(token),
  });

  const cargoQuery = useQuery({
    queryKey: ["cargo"],
    queryFn: () => getCollection<CargoItem>("/cargo-items?pageSize=200", token!),
    enabled: Boolean(token),
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(token!),
    enabled: Boolean(token),
  });

  const invalidateData = () => {
    void queryClient.invalidateQueries({ queryKey: ["expeditions"] });
    void queryClient.invalidateQueries({ queryKey: ["expedition"] });
    void queryClient.invalidateQueries({ queryKey: ["expedition-readiness"] });
    void queryClient.invalidateQueries({ queryKey: ["personnel"] });
    void queryClient.invalidateQueries({ queryKey: ["cargo"] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: () =>
      createExpedition(token!, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        destination: formDestination.trim() || null,
        description: formDescription.trim() || null,
        status: formStatus,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        coordinatorId: formCoordinatorId || null,
        coordinatorName: formCoordinatorName.trim() || null,
        leadScientistId: formLeadScientistId || null,
      }),
    onSuccess: (newExpedition) => {
      setShowCreateModal(false);
      resetForm();
      setSelectedExpeditionId(newExpedition.id);
      setActionNotice(`Expedition "${newExpedition.name}" created successfully.`);
      invalidateData();
    },
    onError: (err: Error) => {
      setActionNotice(`Error: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateExpedition(token!, editId, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        destination: formDestination.trim() || null,
        description: formDescription.trim() || null,
        status: formStatus,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        coordinatorId: formCoordinatorId || null,
        coordinatorName: formCoordinatorName.trim() || null,
        leadScientistId: formLeadScientistId || null,
      }),
    onSuccess: (updated) => {
      setShowEditModal(false);
      setActionNotice(`Expedition "${updated.name}" updated successfully.`);
      invalidateData();
    },
    onError: (err: Error) => {
      setActionNotice(`Error: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpedition(token!, id),
    onSuccess: () => {
      setShowDeleteModal(false);
      setSelectedExpeditionId(null);
      setActionNotice("Expedition deleted successfully.");
      invalidateData();
    },
    onError: (err: Error) => {
      setActionNotice(`Delete failed: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" }) =>
      updateExpedition(token!, id, { status }),
    onSuccess: (_, variables) => {
      setActionNotice(`Mission status transitioned to ${variables.status}.`);
      invalidateData();
    },
  });

  const assignPersonnelMutation = useMutation({
    mutationFn: () => {
      const parts = personnelName.trim().split(" ");
      const firstName = parts[0] || "Member";
      const lastName = parts.slice(1).join(" ") || "Personnel";
      return createPersonnel(token!, {
        expeditionId: selectedExpeditionId,
        firstName,
        lastName,
        role: personnelRole,
      });
    },
    onSuccess: () => {
      setPersonnelName("");
      setActionNotice("Personnel assigned to expedition.");
      invalidateData();
    },
  });

  const assignCargoMutation = useMutation({
    mutationFn: () =>
      createCargoItem(token!, {
        expeditionId: selectedExpeditionId,
        trackingCode: `TRACK-${Date.now().toString().slice(-6)}`,
        name: cargoName.trim(),
        category: cargoCategory,
      }),
    onSuccess: () => {
      setCargoName("");
      setActionNotice("Cargo assigned to expedition manifest.");
      invalidateData();
    },
  });

  function resetForm() {
    setEditId("");
    setFormName("");
    setFormCode("");
    setFormDestination("");
    setFormDescription("");
    setFormStartDate("");
    setFormEndDate("");
    setFormStatus("PLANNED");
    setFormCoordinatorId("");
    setFormCoordinatorName("");
    setFormLeadScientistId("");
    setCodeFeedback(null);
  }

  function handleOpenCreate() {
    resetForm();
    setShowCreateModal(true);
    // Automatically generate next code
    void handleGenerateCode();
  }

  function handleOpenEdit(exp: Expedition) {
    setEditId(exp.id);
    setFormName(exp.name);
    setFormCode(exp.code);
    setFormDestination(exp.destination || "");
    setFormDescription(exp.description || "");
    setFormStartDate(exp.startDate ? exp.startDate.slice(0, 10) : "");
    setFormEndDate(exp.endDate ? exp.endDate.slice(0, 10) : "");
    setFormStatus(exp.status);
    setFormCoordinatorId(exp.coordinatorId || "");
    setFormCoordinatorName(exp.coordinatorName || exp.coordinator?.name || "");
    setFormLeadScientistId(exp.leadScientistId || "");
    setCodeFeedback(null);
    setShowEditModal(true);
  }

  async function handleGenerateCode() {
    if (!token) return;
    setIsCheckingCode(true);
    try {
      const res = await generateExpeditionCode(token, "IEA");
      setFormCode(res.code);
      setCodeFeedback({ valid: true, message: `Auto-generated sequential code "${res.code}"` });
    } catch {
      setCodeFeedback(null);
    } finally {
      setIsCheckingCode(false);
    }
  }

  async function handleValidateCode(codeToValidate: string, currentId?: string) {
    if (!token || !codeToValidate.trim()) {
      setCodeFeedback(null);
      return;
    }
    setIsCheckingCode(true);
    try {
      const res = await validateExpeditionCode(token, codeToValidate.trim(), currentId);
      if (res.valid) {
        setCodeFeedback({ valid: true, message: "Code format is valid and available." });
      } else {
        setCodeFeedback({ valid: false, message: res.error || "Invalid code." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Validation error";
      setCodeFeedback({ valid: false, message });
    } finally {
      setIsCheckingCode(false);
    }
  }

  // Filtered expeditions list
  const filteredExpeditions = useMemo(() => {
    const list = expeditionsQuery.data?.data || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.destination && item.destination.toLowerCase().includes(q)) ||
        (item.coordinatorName && item.coordinatorName.toLowerCase().includes(q))
    );
  }, [expeditionsQuery.data?.data, searchQuery]);

  // Selected expedition details
  const selectedExpedition = useMemo(() => {
    if (!selectedExpeditionId) return null;
    return (
      selectedExpeditionQuery.data ||
      expeditionsQuery.data?.data.find((e) => e.id === selectedExpeditionId) ||
      null
    );
  }, [selectedExpeditionId, selectedExpeditionQuery.data, expeditionsQuery.data?.data]);

  const assignedPersonnel = useMemo(() => {
    if (!selectedExpeditionId) return [];
    return (personnelQuery.data?.data || []).filter((p) => p.expeditionId === selectedExpeditionId);
  }, [selectedExpeditionId, personnelQuery.data?.data]);

  const assignedCargo = useMemo(() => {
    if (!selectedExpeditionId) return [];
    return (cargoQuery.data?.data || []).filter((c) => c.expeditionId === selectedExpeditionId);
  }, [selectedExpeditionId, cargoQuery.data?.data]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
              <Compass className="h-3.5 w-3.5" /> Mission Command
            </span>
            <span className="text-xs font-medium text-slate-500">Antarctic & Arctic Polar Operations</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Expedition / Mission Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Administer primary polar scientific expeditions, coordinate command personnel, allocate cargo & equipment manifests, and track mission readiness.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <Plus className="h-4 w-4" /> Create Expedition
            </button>
          </div>
        )}
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-sky-600 hover:text-sky-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search expedition by name, code (e.g. IEA-46), or station..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status:
          </span>
          {(["ALL", "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === status
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Expedition Cards & Detail Inspector */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] items-start">
        {/* Left Column: Expedition Cards List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <span>Expeditions ({filteredExpeditions.length})</span>
            {expeditionsQuery.isFetching && (
              <span className="flex items-center gap-1 text-sky-600">
                <RefreshCw className="h-3 w-3 animate-spin" /> Updating...
              </span>
            )}
          </div>

          {filteredExpeditions.length === 0 && !expeditionsQuery.isLoading && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-white">
              <Compass className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="mt-3 font-semibold text-slate-700">No expeditions found</h3>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery || statusFilter !== "ALL"
                  ? "Try resetting filters or search terms."
                  : "Create your first expedition mission to get started."}
              </p>
              {canManage && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Expedition
                </button>
              )}
            </div>
          )}

          {filteredExpeditions.map((item) => {
            const isSelected = selectedExpeditionId === item.id;
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.PLANNED;
            const personnelCount = item._count?.personnel ?? 0;
            const cargoCount = item._count?.cargoItems ?? 0;
            const readinessScore = item.readiness?.score ?? 0;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedExpeditionId(item.id)}
                className={`relative rounded-2xl border p-5 transition cursor-pointer bg-white shadow-sm hover:shadow-md ${
                  isSelected
                    ? "border-sky-500 ring-2 ring-sky-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Header row: Code, Name, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {item.code}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.badgeClass}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900 leading-snug">
                      {item.code} — {item.name}
                    </h3>
                  </div>

                  {/* Readiness Badge */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Readiness
                    </div>
                    <span
                      className={`inline-block mt-0.5 text-sm font-extrabold px-2 py-0.5 rounded-lg ${
                        readinessScore >= 80
                          ? "bg-emerald-100 text-emerald-800"
                          : readinessScore >= 50
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {readinessScore}%
                    </span>
                  </div>
                </div>

                {/* Key Expedition Details (Matches Prompt Example Exactly) */}
                <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-600 flex-shrink-0" />
                    <span className="truncate">
                      <strong>Destination:</strong> {item.destination || "Not assigned"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                    <span className="truncate">
                      <strong>Coordinator:</strong> {item.coordinatorName || item.coordinator?.name || "Dr. ABC"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong>Start:</strong> {formatDisplayDate(item.startDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong>End:</strong> {formatDisplayDate(item.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    <span>
                      <strong>Personnel:</strong> {personnelCount} crew
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />
                    <span>
                      <strong>Cargo:</strong> {cargoCount} items
                    </span>
                  </div>
                </div>

                {/* Readiness Progress Bar */}
                <div className="mt-3.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span>Mission Readiness</span>
                    <span className="font-semibold text-slate-600">{readinessScore}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        readinessScore >= 80
                          ? "bg-emerald-500"
                          : readinessScore >= 50
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.max(4, readinessScore)}%` }}
                    />
                  </div>
                </div>

                {/* Card Action Links */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExpeditionId(item.id);
                    }}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    View details & checklist →
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Edit expedition"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedExpeditionId(item.id);
                          setShowDeleteModal(true);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete or cancel expedition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Expedition Inspector */}
        <div className="sticky top-6">
          {selectedExpedition ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {selectedExpedition.code}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        STATUS_CONFIG[selectedExpedition.status]?.badgeClass || ""
                      }`}
                    >
                      {selectedExpedition.status}
                    </span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {selectedExpedition.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    ID: <span className="font-mono">{selectedExpedition.id}</span>
                  </p>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleOpenEdit(selectedExpedition)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <Edit className="h-3.5 w-3.5 text-slate-500" /> Edit Expedition
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" /> Cancel / Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Status Switcher Toolbar (for Admin/Coordinator) */}
              {canManage && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" /> Transition Status:
                  </span>
                  <div className="flex gap-1.5">
                    {(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((st) => (
                      <button
                        key={st}
                        disabled={selectedExpedition.status === st}
                        onClick={() =>
                          updateStatusMutation.mutate({ id: selectedExpedition.id, status: st })
                        }
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${
                          selectedExpedition.status === st
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mission Readiness Dashboard Widget */}
              <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-sky-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Expedition Readiness</h4>
                      <p className="text-xs text-slate-500">
                        {readinessQuery.data?.summary || selectedExpedition.readiness?.summary || "Readiness assessment computed."}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-2xl font-black ${
                        (readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0) >= 80
                          ? "text-emerald-600"
                          : (readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0) >= 50
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0}%
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-400">READINESS</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      (readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0) >= 80
                        ? "bg-emerald-500"
                        : (readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0) >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{
                      width: `${Math.max(5, readinessQuery.data?.score ?? selectedExpedition.readiness?.score ?? 0)}%`,
                    }}
                  />
                </div>

                {/* Readiness Checklist Items */}
                <div className="mt-4 divide-y divide-slate-100 rounded-lg bg-white border border-slate-200">
                  {(readinessQuery.data?.checklist || []).map((check) => (
                    <div key={check.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {check.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className={`font-semibold ${check.passed ? "text-slate-800" : "text-slate-700"}`}>
                            {check.label}
                          </p>
                          <p className="text-[11px] text-slate-400">{check.description}</p>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        +{check.score}/{check.weight}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Parameters Table / Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Destination
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-800">
                    <MapPin className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    <span>{selectedExpedition.destination || "Pending destination"}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Operating Schedule
                  </span>
                  <div className="mt-1 font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>
                      {formatDisplayDate(selectedExpedition.startDate)} — {formatDisplayDate(selectedExpedition.endDate)}
                    </span>
                  </div>
                  {calculateDurationDays(selectedExpedition.startDate, selectedExpedition.endDate) && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      Duration: {calculateDurationDays(selectedExpedition.startDate, selectedExpedition.endDate)} days
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Expedition Coordinator
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-800">
                    <Shield className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <span>
                      {selectedExpedition.coordinatorName || selectedExpedition.coordinator?.name || "Dr. ABC"}
                    </span>
                  </div>
                  {selectedExpedition.coordinator?.email && (
                    <span className="text-[10px] text-slate-400">{selectedExpedition.coordinator.email}</span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Lead Scientist
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-800">
                    <UserCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      {selectedExpedition.leadScientist
                        ? `${selectedExpedition.leadScientist.firstName} ${selectedExpedition.leadScientist.lastName}`
                        : "Pending Appointment"}
                    </span>
                  </div>
                  {selectedExpedition.leadScientist?.organization && (
                    <span className="text-[10px] text-slate-400">
                      {selectedExpedition.leadScientist.organization}
                    </span>
                  )}
                </div>
              </div>

              {/* Description / Scope */}
              {selectedExpedition.description && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-3.5 text-xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Mission Scope & Objectives
                  </span>
                  <p className="text-slate-700 leading-relaxed">{selectedExpedition.description}</p>
                </div>
              )}

              {/* Sub-sections: Personnel & Cargo Assignment */}
              <div className="grid gap-4 md:grid-cols-2 pt-2">
                {/* Personnel Section */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Users className="h-4 w-4 text-emerald-600" />
                      Assigned Personnel ({assignedPersonnel.length})
                    </h4>
                  </div>

                  {canManage && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (personnelName.trim()) assignPersonnelMutation.mutate();
                      }}
                      className="mb-3 space-y-2"
                    >
                      <input
                        type="text"
                        placeholder="Full Name (e.g. Dr. Ramesh Kumar)"
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2"
                        value={personnelName}
                        onChange={(e) => setPersonnelName(e.target.value)}
                        required
                      />
                      <div className="flex gap-2">
                        <select
                          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 flex-1"
                          value={personnelRole}
                          onChange={(e) => setPersonnelRole(e.target.value)}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="LEAD">Expedition Lead</option>
                          <option value="SCIENTIST">Scientist</option>
                          <option value="LOGISTICS">Logistics</option>
                          <option value="MEDICAL">Medical Officer</option>
                          <option value="ENGINEER">Engineer</option>
                        </select>
                        <button
                          type="submit"
                          disabled={assignPersonnelMutation.isPending}
                          className="bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {assignedPersonnel.map((p) => (
                      <div key={p.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5">({p.role})</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {p.status}
                        </span>
                      </div>
                    ))}
                    {assignedPersonnel.length === 0 && (
                      <p className="text-slate-400 text-center py-3 text-xs italic">
                        No personnel assigned yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Cargo Section */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Package className="h-4 w-4 text-cyan-600" />
                      Assigned Cargo ({assignedCargo.length})
                    </h4>
                  </div>

                  {canManage && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (cargoName.trim()) assignCargoMutation.mutate();
                      }}
                      className="mb-3 space-y-2"
                    >
                      <input
                        type="text"
                        placeholder="Item Name (e.g. Drilling Rig Spares)"
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2"
                        value={cargoName}
                        onChange={(e) => setCargoName(e.target.value)}
                        required
                      />
                      <div className="flex gap-2">
                        <select
                          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 flex-1"
                          value={cargoCategory}
                          onChange={(e) => setCargoCategory(e.target.value)}
                        >
                          <option value="General Cargo">General Cargo</option>
                          <option value="Scientific Equipment">Scientific Equipment</option>
                          <option value="Fuel / Energy">Fuel / Energy</option>
                          <option value="Medical Supplies">Medical Supplies</option>
                          <option value="Food & Rations">Food & Rations</option>
                        </select>
                        <button
                          type="submit"
                          disabled={assignCargoMutation.isPending}
                          className="bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {assignedCargo.map((c) => (
                      <div key={c.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                            {c.trackingCode}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold">
                          {c.status}
                        </span>
                      </div>
                    ))}
                    {assignedCargo.length === 0 && (
                      <p className="text-slate-400 text-center py-3 text-xs italic">
                        No cargo items registered yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white">
              <Compass className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="mt-3 font-semibold text-slate-700">Select an expedition</h3>
              <p className="mt-1 text-xs text-slate-500">
                Click any expedition card on the left to inspect command leadership, personnel rosters, cargo manifests, and readiness checklists.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT EXPEDITION MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {showEditModal ? "Edit Expedition" : "Create New Expedition"}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure mission objectives, code validation, destination, and command appointments.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (showEditModal) {
                  updateMutation.mutate();
                } else {
                  createMutation.mutate();
                }
              }}
              className="p-6 space-y-4"
            >
              {/* Expedition Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expedition Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indian Antarctic Expedition"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Code Generator & Validator Row */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Expedition Code <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isCheckingCode}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" /> Auto-Generate Code
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. IEA-46"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={formCode}
                    onChange={(e) => {
                      setFormCode(e.target.value.toUpperCase());
                      setCodeFeedback(null);
                    }}
                    onBlur={() => {
                      if (formCode.trim()) {
                        void handleValidateCode(formCode, showEditModal ? editId : undefined);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleValidateCode(formCode, showEditModal ? editId : undefined)}
                    disabled={isCheckingCode || !formCode.trim()}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isCheckingCode ? "Checking..." : "Validate"}
                  </button>
                </div>
                {codeFeedback && (
                  <p
                    className={`mt-1 text-xs flex items-center gap-1 ${
                      codeFeedback.valid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {codeFeedback.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {codeFeedback.message}
                  </p>
                )}
              </div>

              {/* Destination with Suggestions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Destination / Polar Station
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maitri Station"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formDestination}
                  onChange={(e) => setFormDestination(e.target.value)}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {STANDARD_DESTINATIONS.map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setFormDestination(dest.split(" ")[0] + " Station")}
                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 font-medium transition"
                    >
                      {dest.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mission Scope & Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize scientific objectives, logistics window, and operational overview..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Dates & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED")
                    }
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Leadership Assignments: Coordinator & Lead Scientist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Coordinator
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    value={formCoordinatorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFormCoordinatorId(id);
                      const u = usersQuery.data?.data.find((item) => item.id === id);
                      if (u) setFormCoordinatorName(u.name);
                    }}
                  >
                    <option value="">-- Select Registered User --</option>
                    {(usersQuery.data?.data || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5">
                    <input
                      type="text"
                      placeholder="Or enter Coordinator Name (e.g. Dr. ABC)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
                      value={formCoordinatorName}
                      onChange={(e) => setFormCoordinatorName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Lead Scientist
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    value={formLeadScientistId}
                    onChange={(e) => setFormLeadScientistId(e.target.value)}
                  >
                    <option value="">-- Select Personnel Member --</option>
                    {(personnelQuery.data?.data || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.role})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Lead scientist can be designated from assigned scientific staff.
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : showEditModal
                    ? "Update Expedition"
                    : "Create Expedition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / CANCEL CONFIRMATION DIALOG */}
      {showDeleteModal && selectedExpedition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Cancel or Delete Expedition?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong>{selectedExpedition.code} — {selectedExpedition.name}</strong>?
            </p>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <strong>Recommendation:</strong> Setting the expedition status to <em>CANCELLED</em> preserves historical audit records and cargo tracking links. Hard deletion permanently purges the record.
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => {
                  updateStatusMutation.mutate({ id: selectedExpedition.id, status: "CANCELLED" });
                  setShowDeleteModal(false);
                }}
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
              >
                Mark as CANCELLED (Recommended)
              </button>
              <button
                onClick={() => deleteMutation.mutate(selectedExpedition.id)}
                disabled={deleteMutation.isPending}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Permanently Delete Record"}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
