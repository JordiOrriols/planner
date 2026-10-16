import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { format } from "date-fns";
import { buttonVariants } from "@jordiorriols/ui";
import { DropdownMenu } from "@jordiorriols/ui/radix";
import { Check, ChevronDown } from "@jordiorriols/ui/icons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ROLES, ROLE_LABELS, squadVelocity, fmtShortDate } from "@/lib/planning";
import type { Availability, LinkedTeam, PlannerMember } from "@/types/planner";

const AREA_COLORS = { backend: "#0369a1", frontend: "#38bdf8", design: "#d97706", qa: "#059669" };
const TEAM_COLORS = [
  "#0369a1",
  "#38bdf8",
  "#059669",
  "#d97706",
  "#64748b",
  "#be185d",
  "#0d9488",
  "#7c3aed",
];
const MENU_ITEM =
  "relative flex items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted";
const SELECTOR = buttonVariants({
  variant: "outline",
  className: "h-9 w-36 justify-between text-sm",
});

export default function SquadVelocity({
  members,
  linkedTeams,
  availability,
  startDate,
}: {
  members: PlannerMember[];
  linkedTeams: LinkedTeam[];
  availability: Availability[];
  startDate: Date;
}) {
  const { t } = useTranslation();

  const [groupBy, setGroupBy] = useState<"areas" | "teams">("areas");
  const [excluded, setExcluded] = useState<{ areas: string[]; teams: string[] }>({
    areas: [],
    teams: [],
  });
  const options =
    groupBy === "areas"
      ? ROLES.map((role) => ({
          id: role,
          name: ROLE_LABELS[role],
          color: AREA_COLORS[role],
          members: members.filter((member) => member.role === role),
        }))
      : linkedTeams.map((team, index) => ({
          id: team.id,
          name: team.name,
          color: TEAM_COLORS[index % TEAM_COLORS.length]!,
          members: members.filter((member) => member.team_id === team.id && member.role !== null),
        }));
  const selected = options.filter((option) => !excluded[groupBy].includes(option.id));
  const allSelected = options.length > 0 && selected.length === options.length;
  const weeks = squadVelocity([], availability, startDate, 16);
  const series = selected.map((option) => ({
    ...option,
    weeks: squadVelocity(option.members, availability, startDate, 16),
  }));
  const chartData = weeks.map((week, index) => ({
    date: format(week.weekStart, "yyyy-MM-dd"),
    label: fmtShortDate(week.weekStart),
    ...Object.fromEntries(
      series.map((item, seriesIndex) => [
        `series${seriesIndex}`,
        Number(item.weeks[index]!.capacity.toFixed(2)),
      ])
    ),
  }));
  const selectionLabel = allSelected
    ? t(`velocity.filters.all.${groupBy}`)
    : selected.length === 1
      ? selected[0]!.name
      : t(`velocity.filters.selected.${groupBy}`, { count: selected.length });
  return (
    <section className="panel p-5" aria-label={t("velocity.title")}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold">{t("velocity.title")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("velocity.description", { count: weeks.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("velocity.filters.groupBy")}
            <span className="relative">
              <select
                className={`${SELECTOR} appearance-none pr-8`}
                aria-label={t("velocity.filters.groupingLabel")}
                value={groupBy}
                onChange={(event) => {
                  if (event.target.value === "areas" || event.target.value === "teams")
                    setGroupBy(event.target.value);
                }}
              >
                <option value="areas">{t("velocity.filters.areas")}</option>
                <option value="teams">{t("velocity.filters.teams")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </span>
          </label>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span>{t(`velocity.filters.show.${groupBy}`)}</span>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger
                className={SELECTOR}
                aria-label={t(`velocity.filters.selectLabel.${groupBy}`)}
                disabled={!options.length}
              >
                <span className="min-w-0 truncate">{selectionLabel}</span>
                <ChevronDown className="size-4 shrink-0" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-48 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
                >
                  <DropdownMenu.CheckboxItem
                    className={MENU_ITEM}
                    checked={allSelected}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) =>
                      setExcluded((current) => ({
                        ...current,
                        [groupBy]: checked ? [] : options.map((option) => option.id),
                      }))
                    }
                  >
                    <span className="size-4">
                      <DropdownMenu.ItemIndicator>
                        <Check className="size-4" />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    {t(`velocity.filters.all.${groupBy}`)}
                  </DropdownMenu.CheckboxItem>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  {options.map((option) => (
                    <DropdownMenu.CheckboxItem
                      key={option.id}
                      className={MENU_ITEM}
                      checked={!excluded[groupBy].includes(option.id)}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) =>
                        setExcluded((current) => ({
                          ...current,
                          [groupBy]: checked
                            ? current[groupBy].filter((id) => id !== option.id)
                            : [...current[groupBy], option.id],
                        }))
                      }
                    >
                      <span className="size-4">
                        <DropdownMenu.ItemIndicator>
                          <Check className="size-4" />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      <span
                        className="size-2 rounded-sm"
                        style={{ backgroundColor: option.color }}
                      />
                      {option.name}
                    </DropdownMenu.CheckboxItem>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>
      {!series.length ? (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          {options.length
            ? t("velocity.empty.selectionRequired")
            : t("velocity.empty.teamRequired")}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals />
            <Tooltip />
            {series.map((item, index) => (
              <Bar
                key={item.id}
                dataKey={`series${index}`}
                name={item.name}
                fill={item.color}
                {...(series.length > 1 ? { stackId: "capacity" } : {})}
                radius={index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {series.length > 0 && (
        <ul
          aria-label={t("velocity.legend")}
          className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
        >
          {series.map((item) => (
            <li key={item.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </li>
          ))}
        </ul>
      )}
      <table className="sr-only">
        <caption>{t("velocity.tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("common.weekOf")}</th>
            {series.map((item) => (
              <th key={item.id} scope="col">
                {item.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.map((week, index) => (
            <tr key={week.date}>
              <th scope="row">{week.date}</th>
              {series.map((item) => (
                <td key={item.id}>{Number(item.weeks[index]!.capacity.toFixed(2))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
