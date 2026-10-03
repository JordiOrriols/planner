import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLES, ROLE_LABELS, ROLE_COLORS, peakDevs, durationWeeks, totalDevWeeks } from "@/lib/planning";
import { cn } from "@/lib/utils";

const EMPTY = {
  name: "", description: "",
  backend_devs: 0, backend_weeks: 0,
  frontend_devs: 0, frontend_weeks: 0,
  design_devs: 0, design_weeks: 0,
  qa_devs: 0, qa_weeks: 0
};

export default function ProjectForm({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [open, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setNum = (k, v) => setForm(f => ({ ...f, [k]: v === "" ? 0 : Math.max(0, Number(v)) }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, backend_devs: Number(form.backend_devs)||0, backend_weeks: Number(form.backend_weeks)||0,
      frontend_devs: Number(form.frontend_devs)||0, frontend_weeks: Number(form.frontend_weeks)||0,
      design_devs: Number(form.design_devs)||0, design_weeks: Number(form.design_weeks)||0,
      qa_devs: Number(form.qa_devs)||0, qa_weeks: Number(form.qa_weeks)||0 });
    onClose();
  };

  const peak = peakDevs(form);
  const dur = durationWeeks(form);
  const dw = totalDevWeeks(form);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit microproject" : "New microproject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Checkout redesign" autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Short scope summary" />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-3">Role</div>
              <div className="col-span-4 text-center">Developers</div>
              <div className="col-span-4 text-center">Weeks</div>
              <div className="col-span-1 text-center">DW</div>
            </div>
            <div className="divide-y divide-border">
              {ROLES.map(role => (
                <div key={role} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                  <div className="col-span-3 flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", ROLE_COLORS[role])} />
                    <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min={0} value={form[`${role}_devs`]} onChange={e => setNum(`${role}_devs`, e.target.value)} className="text-center" />
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min={0} value={form[`${role}_weeks`]} onChange={e => setNum(`${role}_weeks`, e.target.value)} className="text-center" />
                  </div>
                  <div className="col-span-1 text-center text-sm tabular-nums text-muted-foreground">
                    {(Number(form[`${role}_devs`])||0) * (Number(form[`${role}_weeks`])||0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-brand/10 text-brand px-3 py-1.5 font-medium">Peak team: {peak} dev{peak===1?"":"s"}</span>
            <span className="rounded-lg bg-muted px-3 py-1.5 font-medium">Duration: {dur} week{dur===1?"":"s"}</span>
            <span className="rounded-lg bg-muted px-3 py-1.5 font-medium">Total effort: {dw} dev-weeks</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{initial ? "Save changes" : "Create microproject"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}