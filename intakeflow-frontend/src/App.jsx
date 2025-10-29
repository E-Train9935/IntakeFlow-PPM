// intakeflow-frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, API_KEY } from "./config"; // import from config.js

const STATUSES = ["Initiated", "Approved", "InProgress", "OnHold", "Completed", "Rejected"];

function classForStatus(s) {
  const k = (s || "").toLowerCase();
  if (k === "completed") return "badge bg-emerald-300/20 text-emerald-200 ring-1 ring-emerald-400/30";
  if (k === "inprogress") return "badge bg-brand-300/20 text-brand-100 ring-1 ring-brand-400/30";
  if (k === "approved") return "badge bg-sky-300/20 text-sky-200 ring-1 ring-sky-400/30";
  if (k === "onhold") return "badge bg-amber-300/20 text-amber-200 ring-1 ring-amber-400/30";
  if (k === "rejected") return "badge bg-zinc-300/20 text-zinc-200 ring-1 ring-zinc-400/30";
  return "badge bg-fuchsia-300/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30";
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return Array.from(map.entries());
}
function csvSafe(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function fmtDateISO(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState(() => localStorage.getItem("if_q") ?? "");
  const [portfolioFilter, setPortfolioFilter] = useState(() => localStorage.getItem("if_pf") ?? "All");
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem("if_sf") ?? "All");

  useEffect(() => localStorage.setItem("if_q", q), [q]);
  useEffect(() => localStorage.setItem("if_pf", portfolioFilter), [portfolioFilter]);
  useEffect(() => localStorage.setItem("if_sf", statusFilter), [statusFilter]);

  const [form, setForm] = useState({ name: "", plannerTaskId: "", portfolio: "", startDate: "", endDate: "" });
  const [submitting, setSubmitting] = useState(false);

  const [statusDraft, setStatusDraft] = useState({});
  const [savingStatusId, setSavingStatusId] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editModel, setEditModel] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setProjects(data);
      const d = {};
      data.forEach((p) => (d[p.id] = p.status));
      setStatusDraft(d);
    } catch (err) {
      setError(err.message ?? "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchProjects(); }, []);

  const portfolios = useMemo(() => ["All", ...Array.from(new Set(projects.map((p) => p.portfolio || "General")))], [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesQ = q.trim().length === 0 ||
        [p.name, p.portfolio, p.plannerTaskId, p.status].filter(Boolean).some((x) => x.toLowerCase().includes(q.toLowerCase()));
      const matchesPortfolio = portfolioFilter === "All" || (p.portfolio || "General") === portfolioFilter;
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesQ && matchesPortfolio && matchesStatus;
    });
  }, [projects, q, portfolioFilter, statusFilter]);

  // Timeline calc
  const [minDate, maxDate] = useMemo(() => {
    const dates = filtered.flatMap((p) => [p.startDate, p.endDate]).filter(Boolean).map((d) => new Date(d));
    if (dates.length === 0) {
      const t = new Date();
      return [t, new Date(t.getFullYear(), t.getMonth() + 6, t.getDate())];
    }
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const padL = new Date(min); padL.setMonth(min.getMonth() - 1);
    const padR = new Date(max); padR.setMonth(max.getMonth() + 1);
    return [padL, padR];
  }, [filtered]);

  const ticks = useMemo(() => {
    const list = [];
    const d = new Date(minDate);
    d.setDate(1);
    d.setMonth(Math.floor(d.getMonth() / 3) * 3);
    while (d <= maxDate) {
      const qn = Math.floor(d.getMonth() / 3) + 1;
      list.push({ date: new Date(d), label: `Q${qn} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 3);
    }
    return list;
  }, [minDate, maxDate]);

  const spanMs = maxDate - minDate;
  const pct = (ms) => `${(ms / spanMs) * 100}%`;
  const barStyle = (start, end) => {
    if (!start || !end) return { left: "0%", width: "0%" };
    const s = new Date(start), e = new Date(end);
    return { left: pct(Math.max(0, s - minDate)), width: pct(Math.max(0, e - s)) };
  };

  // Create
  const onCreateChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const onCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.plannerTaskId.trim()) {
      setError("Please provide both Name and Planner Task ID.");
      return;
    }
    try {
      setSubmitting(true); setError("");
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({
          name: form.name.trim(),
          plannerTaskId: form.plannerTaskId.trim(),
          portfolio: form.portfolio.trim() || "General",
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 409) throw new Error(text || "Duplicate Planner Task ID.");
        if (res.status === 404) throw new Error("Project not found (404).");
        if (res.status === 401) throw new Error("Unauthorized (missing or bad x-api-key).");
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      setForm({ name: "", plannerTaskId: "", portfolio: "", startDate: "", endDate: "" });
      await fetchProjects();
    } catch (err) {
      setError(err.message ?? "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  // Status
  const onStatusDraftChange = (id, value) => setStatusDraft((d) => ({ ...d, [id]: value }));
  const saveStatus = async (id) => {
    try {
      setSavingStatusId(id); setError("");
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ status: statusDraft[id] }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 404) throw new Error("Project not found (404).");
        if (res.status === 401) throw new Error("Unauthorized (missing or bad x-api-key).");
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      await fetchProjects();
    } catch (err) {
      setError(err.message ?? "Failed to update status");
    } finally {
      setSavingStatusId(null);
    }
  };

  // Edit/Delete
  const openEdit = (p) => {
    setEditModel({
      id: p.id,
      name: p.name,
      plannerTaskId: p.plannerTaskId,
      status: p.status,
      portfolio: p.portfolio || "General",
      startDate: p.startDate ? p.startDate.substring(0, 10) : "",
      endDate: p.endDate ? p.endDate.substring(0, 10) : "",
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    try {
      setError("");
      const body = {
        name: editModel.name.trim(),
        plannerTaskId: editModel.plannerTaskId.trim(),
        status: editModel.status,
        portfolio: editModel.portfolio.trim() || "General",
        startDate: editModel.startDate ? new Date(editModel.startDate).toISOString() : null,
        endDate: editModel.endDate ? new Date(editModel.endDate).toISOString() : null,
      };
      const res = await fetch(`${API_BASE}/${editModel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 409) throw new Error(text || "Duplicate Planner Task ID.");
        if (res.status === 404) throw new Error("Project not found (404).");
        if (res.status === 401) throw new Error("Unauthorized (missing or bad x-api-key).");
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      setEditOpen(false);
      await fetchProjects();
    } catch (err) {
      setError(err.message ?? "Failed to save changes");
    }
  };
  const doDelete = async (id) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        if (res.status === 404) throw new Error("Project not found (404).");
        if (res.status === 401) throw new Error("Unauthorized (missing or bad x-api-key).");
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      await fetchProjects();
    } catch (err) {
      setError(err.message ?? "Failed to delete");
    }
  };

  // CSV
  const exportCsv = () => {
    const header = ["Id","Name","Status","PlannerTaskId","Portfolio","StartDate","EndDate"];
    const rows = filtered.map((p) => [
      p.id, csvSafe(p.name), p.status, csvSafe(p.plannerTaskId), csvSafe(p.portfolio || "General"), p.startDate || "", p.endDate || ""
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `intakeflow_export_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const metrics = useMemo(() => {
    const m = { total: filtered.length };
    for (const s of STATUSES) m[s] = filtered.filter((p) => p.status === s).length;
    return m;
  }, [filtered]);

  return (
    <div className="min-h-screen font-sans text-zinc-100 bg-gradient-to-br from-[#0A051A] via-[#120A2A] to-[#1B0D3D] relative">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl animate-slow-pulse"></div>
        <div className="absolute -bottom-28 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-slow-pulse"></div>
      </div>

      {/* Header (glass) */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/5 border-b border-white/10 shadow-soft">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            <span className="text-white">IntakeFlow</span>{" "}
            <span className="text-brand-300">PPM Gateway</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="rounded-full px-4 py-2 border border-white/15 text-brand-100 hover:bg-white/10 transition shadow-inset"
              title="Export current view"
            >
              Export CSV
            </button>
            <button
              onClick={fetchProjects}
              className="rounded-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white shadow-glow transition"
              title="Refresh"
            >
              ⟳ Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-8 space-y-8">
        {loading && (
          <div className="glass p-4 text-brand-100">Loading projects…</div>
        )}
        {!!error && !loading && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Filters (glass) */}
        <section className="glass-strong p-6">
          <div className="grid gap-4 md:grid-cols-5">
            <input
              className="md:col-span-2 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
              placeholder="Search name, portfolio, status, task id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
              value={portfolioFilter}
              onChange={(e) => setPortfolioFilter(e.target.value)}
            >
              {portfolios.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {["All", ...STATUSES].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="text-right text-sm text-zinc-300 self-center">
              Showing {filtered.length} of {projects.length}
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="grid gap-4 md:grid-cols-5">
          <MetricCard label="Total" value={metrics.total} />
          {STATUSES.map((s) => <MetricCard key={s} label={s} value={metrics[s]} />)}
        </section>

        {/* Create (glass) */}
        <section className="glass-strong p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Quick Create (Planner → Logic App)</h2>
          <form onSubmit={onCreateSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <input name="name" value={form.name} onChange={onCreateChange}
              placeholder="Project Name"
              className="md:col-span-2 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30" />
            <input name="plannerTaskId" value={form.plannerTaskId} onChange={onCreateChange}
              placeholder="Planner Task ID"
              className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30" />
            <input name="portfolio" value={form.portfolio} onChange={onCreateChange}
              placeholder="Portfolio (e.g., IT, Marketing)"
              className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30" />
            <input type="date" name="startDate" value={form.startDate} onChange={onCreateChange}
              className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30" />
            <input type="date" name="endDate" value={form.endDate} onChange={onCreateChange}
              className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30" />
            <div className="md:col-span-6">
              <button type="submit" disabled={submitting}
                className="rounded-full bg-brand-500 hover:bg-brand-600 px-5 py-2.5 font-medium text-white shadow-glow disabled:opacity-60 transition">
                {submitting ? "Creating…" : "Create Project"}
              </button>
            </div>
          </form>
        </section>

        {/* Timeline */}
        <section className="glass p-0 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 bg-white/5">
            <h3 className="text-lg font-semibold text-white">Portfolio Timeline</h3>
          </div>

          <div className="px-4 pt-5">
            <div className="relative h-10">
              <div className="absolute inset-0 rounded-full bg-white/5" />
              {ticks.map((t, i) => {
                const left = ((t.date - minDate) / (maxDate - minDate)) * 100;
                const isYearStart = t.date.getMonth() === 0;
                return (
                  <div key={i} className="absolute top-0 h-full" style={{ left: `${left}%` }}>
                    <div className={`${isYearStart ? "border-l-2 border-brand-400/50" : "border-l border-white/15"} h-full`} />
                    <div className="absolute -bottom-6 -translate-x-1/2 text-[10px] text-zinc-300">{t.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-5">
            {groupBy(filtered, (p) => p.portfolio || "General").map(([portfolio, items]) => (
              <div key={portfolio} className="mt-6">
                <div className="mb-2 text-sm font-semibold text-zinc-200">{portfolio}</div>
                <div className="space-y-3">
                  {items.map((p) => (
                    <div key={`tl-${p.id}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{p.name}</span>
                          <span className={classForStatus(p.status)}>{p.status}</span>
                          <span className="text-zinc-300/90">• {p.plannerTaskId}</span>
                        </div>
                        <div className="text-zinc-400">
                          {fmtDateISO(p.startDate)} → {fmtDateISO(p.endDate)}
                        </div>
                      </div>
                      <div className="relative h-6 rounded-full bg-white/6">
                        <div className="absolute top-0 bottom-0 rounded-full bg-brand-500/70 shadow-glow" style={barStyle(p.startDate, p.endDate)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Projects grid (glass) */}
        <section className="glass overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 bg-white/5">
            <h3 className="text-lg font-semibold text-white">Projects</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/5 text-zinc-300">
                <tr>
                  {["ID","Name","Portfolio","Status","Task ID","Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-sm text-zinc-200">{p.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{p.portfolio || "General"}</td>
                    <td className="px-4 py-3">
                      <span className={classForStatus(p.status)}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{p.plannerTaskId}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-xl bg-white/5 border border-white/15 px-2 py-1 text-sm text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                          value={statusDraft[p.id] ?? p.status}
                          onChange={(e) => setStatusDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => saveStatus(p.id)}
                          disabled={savingStatusId === p.id}
                          className="rounded-full bg-brand-500 hover:bg-brand-600 px-3 py-1 text-sm text-white shadow-glow disabled:opacity-60 transition"
                        >
                          {savingStatusId === p.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-full border border-white/15 px-3 py-1 text-sm text-white hover:bg-white/10 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => doDelete(p.id)}
                          className="rounded-full border border-red-400/30 px-3 py-1 text-sm text-red-200 hover:bg-red-500/10 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-300" colSpan={6}>
                      No projects match your filters. Create one above or adjust filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Edit Modal */}
      {editOpen && editModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl glass-strong p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit Project</h3>
              <button onClick={() => setEditOpen(false)} className="text-zinc-300 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <input className="md:col-span-3 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                placeholder="Name" value={editModel.name} onChange={(e)=>setEditModel({...editModel, name:e.target.value})}/>
              <input className="md:col-span-3 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                placeholder="Planner Task ID" value={editModel.plannerTaskId} onChange={(e)=>setEditModel({...editModel, plannerTaskId:e.target.value})}/>
              <input className="md:col-span-2 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                placeholder="Portfolio" value={editModel.portfolio} onChange={(e)=>setEditModel({...editModel, portfolio:e.target.value})}/>
              <select className="md:col-span-2 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                value={editModel.status} onChange={(e)=>setEditModel({...editModel, status:e.target.value})}>
                {STATUSES.map((s)=> <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                value={editModel.startDate} onChange={(e)=>setEditModel({...editModel, startDate:e.target.value})}/>
              <input type="date" className="md:col-span-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                value={editModel.endDate} onChange={(e)=>setEditModel({...editModel, endDate:e.target.value})}/>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={()=>setEditOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">Cancel</button>
              <button onClick={saveEdit} className="rounded-full bg-brand-500 hover:bg-brand-600 px-4 py-2 text-white shadow-glow">Save changes</button>
            </div>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-zinc-300">
        IntakeFlow • PPM Prototype • Made by Ethian Chiu
      </footer>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="glass p-5">
      <div className="text-sm text-zinc-300">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value ?? 0}</div>
    </div>
  );
}
