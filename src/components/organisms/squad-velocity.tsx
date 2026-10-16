import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { format } from "date-fns";
import { Button, buttonVariants } from "@jordiorriols/ui";
import { DropdownMenu } from "@jordiorriols/ui/radix";
import { Check, ChevronDown, Settings } from "@jordiorriols/ui/icons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ROLES, ROLE_LABELS, fmtShortDate } from "@/lib/planning";
import { calibratedRate, forecastSprints, sprintCapacity } from "@/lib/sprints";
import { ROLE_COLORS } from "@/config/roleColors";
import VelocityCalibration from "@/components/organisms/velocity-calibration";
import type { Availability, LinkedTeam, PlannerMember, SprintResult } from "@/types/planner";

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
  sprintStart,
  history,
  onSaveCalibration,
}: {
  members: PlannerMember[];
  linkedTeams: LinkedTeam[];
  availability: Availability[];
  startDate: Date;
  sprintStart: string;
  history: SprintResult[];
  onSaveCalibration?: (anchor: string, history: SprintResult[]) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [calibrating, setCalibrating] = useState(false);
  let rate: number | null = null;
  let sprints: ReturnType<typeof forecastSprints> = [];
  let error: string | null = null;
  try {
    sprints = forecastSprints(sprintStart, startDate);
    rate = calibratedRate(sprintStart, history, members, availability);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const caption = rate === null ? t("velocity.capacityCaption") : t("velocity.forecastCaption");

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
          color: ROLE_COLORS[role].hex,
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
  const series = selected.map((option) => ({
    ...option,
    values: sprints.map(({ start }) =>
      Number((sprintCapacity(option.members, availability, start) * (rate ?? 1)).toFixed(2))
    ),
  }));
  const chartData = sprints.map((sprint, index) => ({
    date: format(sprint.start, "yyyy-MM-dd"),
    label: `${fmtShortDate(sprint.start)} – ${fmtShortDate(sprint.end)}`,
    ...Object.fromEntries(
      series.map((item, seriesIndex) => [`series${seriesIndex}`, item.values[index]!])
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
            {sprints.length > 0 &&
              t("velocity.sprintDescription", {
                startDate: fmtShortDate(sprints[0]!.start),
                endDate: fmtShortDate(sprints[sprints.length - 1]!.end),
              })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
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
          {onSaveCalibration && (
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label={t("velocity.calibration.open")}
              onClick={() => setCalibrating(true)}
            >
              <Settings className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !sprints.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("velocity.noSprints")}
        </p>
      ) : !series.length ? (
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
            <Tooltip formatter={(value) => number.format(Number(value))} />
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
      {!error && rate === null && (
        <p className="mt-3 text-xs text-muted-foreground">{t("velocity.noHistory")}</p>
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
      {!error && (
        <div className="sr-only">
          <table>
            <caption>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t("velocity.sprintOf")}</th>
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
                    <td key={item.id}>{item.values[index]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {calibrating && onSaveCalibration && (
        <VelocityCalibration
          anchor={sprintStart}
          history={history}
          members={members}
          availability={availability}
          onSave={onSaveCalibration}
          onClose={() => setCalibrating(false)}
        />
      )}
    </section>
  );
}
