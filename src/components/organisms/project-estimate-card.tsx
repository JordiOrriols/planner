import { useTranslation } from "react-i18next";
import React from "react";
import { Pencil, Trash2 } from "@jordiorriols/ui/icons";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types/planner";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  peakDevs,
  durationWeeks,
  totalDevWeeks,
} from "@/lib/planning";
import { cn } from "@/lib/utils";

export default function ProjectEstimateCard({
  project,
  onEdit,
  onDelete,
  disabled,
  readOnly,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();

  const peak = peakDevs(project);
  const dur = durationWeeks(project);
  const dw = totalDevWeeks(project);
  const activeRoles = ROLES.filter(
    (r) => (project[`${r}_devs`] || 0) > 0 || (project[`${r}_weeks`] || 0) > 0
  );

  return (
    <article className="panel flex flex-col gap-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-[15px] tracking-tight truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label={t("copy.edit", { value1: project.name })}
              disabled={disabled}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label={t("copy.delete", { value1: project.name })}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {activeRoles.length === 0 && (
          <span className="text-xs text-muted-foreground italic">{t("copy.noEstimatesYet")}</span>
        )}
        {activeRoles.map((role) => (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
          >
            <span className={cn("h-2 w-2 rounded-full", ROLE_COLORS[role])} />
            {ROLE_LABELS[role]} · {project[`${role}_devs`]}×{project[`${role}_weeks`]}
            {t("copy.w")}
          </span>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-border">
        <Stat label={t("copy.peakTeam")} value={`${peak}`} sub={t("copy.people")} />
        <Stat label={t("copy.duration")} value={`${dur}`} sub={t("copy.weeks")} />
        <Stat label={t("copy.effort")} value={`${dw}`} sub={t("copy.personWks")} />
      </div>
    </article>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}
