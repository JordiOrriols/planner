import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import ProjectEstimateCard from "@/components/ProjectEstimateCard";
import { totalDevWeeks } from "@/lib/planning";

export default function Estimation() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Project.list("-created_date", 200);
      setProjects(list);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (editing) await base44.entities.Project.update(editing.id, data);
    else await base44.entities.Project.create(data);
    load();
  };
  const handleDelete = async (id) => { await base44.entities.Project.delete(id); load(); };
  const handleToggleBacklog = async (p) => { await base44.entities.Project.update(p.id, { in_backlog: !p.in_backlog }); load(); };
  const openEdit = (p) => { setEditing(p); setFormOpen(true); };
  const openNew = () => { setEditing(null); setFormOpen(true); };

  const totalDW = projects.reduce((s, p) => s + totalDevWeeks(p), 0);
  const backlogCount = projects.filter(p => p.in_backlog).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Microproject estimation</h1>
          <p className="text-muted-foreground text-sm mt-1">Estimate developers and weeks per role for each piece of work.</p>
        </div>
        <Button onClick={openNew} className="self-start sm:self-auto"><Plus className="h-4 w-4 mr-1.5" /> New microproject</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-md">
        <Metric label="Microprojects" value={projects.length} />
        <Metric label="In backlog" value={backlogCount} />
        <Metric label="Total effort" value={`${totalDW}`} sub="dev-wks" />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No microprojects yet. Create your first one to start estimating.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <ProjectEstimateCard
              key={p.id}
              project={p}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
              onToggleBacklog={() => handleToggleBacklog(p)}
            />
          ))}
        </div>
      )}

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}