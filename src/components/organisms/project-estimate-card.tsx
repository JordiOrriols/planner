import { useTranslation } from "react-i18next";
import React, { useId, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "@jordiorriols/ui/icons";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types/planner";
import { ROLES, ROLE_LABELS, peakDevs, durationWeeks, totalDevWeeks } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/config/roleColors";

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
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  const peak = peakDevs(project);
  const dur = durationWeeks(project);
  const dw = totalDevWeeks(project);
  const activeRoles = ROLES.filter(
    (r) => (project[`${r}_devs`] || 0) > 0 || (project[`${r}_weeks`] || 0) > 0
  );

  return (
    <article
      aria-label={project.name}
      className="panel flex flex-col gap-4 transition-shadow hover:shadow-md"
    >
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
              aria-label={t("featureCard.actions.edit", { featureName: project.name })}
              disabled={disabled}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label={t("featureCard.actions.delete", { featureName: project.name })}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {activeRoles.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            {t("featureCard.noEstimates")}
          </span>
        )}
        {activeRoles.map((role) => (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
          >
            <span
              data-role-swatch={role}
              className={cn("h-2 w-2 rounded-full", ROLE_COLORS[role].className)}
            />
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <Stat
          label={t("featureCard.metrics.peakTeam")}
          value={`${peak}`}
          sub={t("common.units.people")}
        />
        <Stat
          label={t("featureCard.metrics.duration")}
          value={`${dur}`}
          sub={t("common.units.weeks")}
        />
        <Stat
          label={t("featureCard.metrics.effort")}
          value={`${dw}`}
          sub={t("common.units.personWeeksShort")}
        />
        {!expanded && activeRoles.length > 0 && (
          <div
            role="group"
            aria-label={t("featureCard.roleEffort")}
            className="flex w-full flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 sm:w-auto sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"
          >
            {activeRoles.map((role) => (
              <div key={role}>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    data-role-swatch={role}
                    className={cn("size-2 rounded-full", ROLE_COLORS[role].className)}
                  />
                  {ROLE_LABELS[role]}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1 pl-3.5">
                  <span className="text-sm font-medium tabular-nums">
                    {project[`${role}_devs`] * project[`${role}_weeks`]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("common.units.personWeeksShort")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded((value) => !value)}
        >
          {t(expanded ? "featureCard.hideDetails" : "featureCard.showDetails")}
          <ChevronDown className={cn("ml-2 size-4", expanded && "rotate-180")} />
        </Button>
      </div>

      <div
        id={detailId}
        hidden={!expanded}
        className={cn(
          "gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4",
          expanded && "grid"
        )}
      >
        {ROLES.map((role) => {
          const people = project[`${role}_devs`];
          const weeks = project[`${role}_weeks`];
          return (
            <section
              key={role}
              aria-label={ROLE_LABELS[role]}
              className="min-w-0 rounded-lg bg-muted/40 p-3"
            >
              <h4 className="flex items-center gap-2 text-xs font-medium">
                <span
                  data-role-swatch={role}
                  className={cn("h-2 w-2 rounded-full", ROLE_COLORS[role].className)}
                />
                {ROLE_LABELS[role]}
              </h4>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: t("common.units.people"), value: people, unit: "" },
                  { label: t("common.units.weeks"), value: weeks, unit: "" },
                  {
                    label: t("featureCard.metrics.effort"),
                    value: people * weeks,
                    unit: t("common.units.personWeeksShort"),
                  },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {value}
                      {unit && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          {unit}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
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
