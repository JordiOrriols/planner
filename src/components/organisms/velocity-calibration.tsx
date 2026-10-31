import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Button, Modal } from "@jordiorriols/ui";
import { Plus, Trash2 } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { calibratedRate, sprintCapacity } from "@/lib/sprints";
import { parseDate } from "@/lib/planning";
import type { Vacation, PlannerMember, SprintResult } from "@/types/planner";

export default function VelocityCalibration({
  anchor,
  history,
  members,
  vacations,
  onSave,
  onClose,
}: {
  anchor: string;
  history: SprintResult[];
  members: PlannerMember[];
  vacations: Vacation[];
  onSave: (anchor: string, history: SprintResult[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const formId = useId();
  const [start, setStart] = useState(anchor);
  const [rows, setRows] = useState(
    history.map((result) => ({
      id: crypto.randomUUID(),
      date: result.start_date,
      points: String(result.story_points),
    }))
  );
  const action = useAsyncAction();
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  let rate: number | null = null;
  let capacities: number[] = [];
  let validationError: string | null = null;
  const results = rows.map((row) => ({
    start_date: row.date,
    story_points: row.points.trim() === "" ? NaN : Number(row.points),
  }));
  try {
    rate = calibratedRate(start, results, members, vacations);
    capacities = results.map((result) =>
      sprintCapacity(members, vacations, parseDate(result.start_date))
    );
  } catch (cause) {
    validationError = cause instanceof Error ? cause.message : String(cause);
  }
  function addSprint() {
    const origin = parseDate(start);
    let previous = addDays(
      origin,
      (Math.floor(differenceInCalendarDays(new Date(), origin) / 14) - 1) * 14
    );
    const dates = new Set(rows.map((row) => row.date));
    while (dates.has(format(previous, "yyyy-MM-dd"))) previous = addDays(previous, -14);
    setRows((current) => [
      ...current,
      { id: crypto.randomUUID(), date: format(previous, "yyyy-MM-dd"), points: "" },
    ]);
  }
  return (
    <Modal
      isOpen
      title={t("velocity.calibration.title")}
      description={t("velocity.calibration.description")}
      closeLabel={t("common.actions.close")}
      onOpenChange={(open) => {
        if (!open && !action.busy) onClose();
      }}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={action.busy} onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={action.busy || !!validationError}>
            {t("velocity.calibration.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (action.busy || validationError) return;
          void action.run(async () => {
            await onSave(
              start,
              results.sort((a, b) => a.start_date.localeCompare(b.start_date))
            );
            onClose();
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          {t("velocity.calibration.anchor")}
          <input
            className="field"
            type="date"
            required
            min="2026-01-01"
            max="2027-12-18"
            value={start}
            disabled={action.busy}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid min-w-0 flex-1 gap-1 text-xs">
                  {t("velocity.calibration.date")}
                  <input
                    className="field"
                    type="date"
                    required
                    min="2026-01-01"
                    max="2027-12-18"
                    value={row.date}
                    disabled={action.busy}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, date: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <label className="grid min-w-0 flex-1 gap-1 text-xs">
                  {t("velocity.calibration.points")}
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={row.points}
                    disabled={action.busy}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, points: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={action.busy}
                  aria-label={t("velocity.calibration.remove", { sprintNumber: index + 1 })}
                  onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {capacities[index] !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {t("velocity.calibration.capacity")}: {number.format(capacities[index]!)}
                </p>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={action.busy || !start || !!validationError}
          onClick={addSprint}
        >
          <Plus className="mr-2 size-4" />
          {t("velocity.calibration.add")}
        </Button>
        {rate !== null && !validationError && (
          <p className="text-sm font-medium">
            {t("velocity.calibration.rate", { rate: number.format(rate) })}
          </p>
        )}
        {(validationError || action.error) && (
          <p role="alert" className="text-sm text-destructive">
            {validationError ?? action.error}
          </p>
        )}
      </form>
    </Modal>
  );
}
