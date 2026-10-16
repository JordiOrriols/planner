import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VelocityCalibration from "@/components/organisms/velocity-calibration";
import type { SprintResult } from "@/types/planner";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 2, 2));
});
afterEach(() => vi.useRealTimers());
function setup(history: SprintResult[] = [], hasMembers = true) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <VelocityCalibration
      anchor="2026-02-02"
      history={history}
      members={
        hasMembers
          ? [
              {
                id: "ada",
                name: "Ada",
                role: "backend",
                team_id: "team",
                can_edit: true,
                vacation_token: null,
              },
            ]
          : []
      }
      vacations={[]}
      onSave={onSave}
      onClose={onClose}
    />
  );
  return { onSave, onClose };
}
describe("Velocity calibration editing", () => {
  it("edits points including zero, removes results and cancels without saving", async () => {
    const { onSave, onClose } = setup([{ start_date: "2026-02-02", story_points: 50 }]);
    const points = screen.getByLabelText("Delivered story points");
    await userEvent.clear(points);
    expect(screen.getByRole("button", { name: "Save calibration" })).toBeDisabled();
    await userEvent.type(points, "0");
    expect(screen.getByText("0 story points per available person-week")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove sprint 1" }));
    expect(screen.queryByLabelText("Delivered story points")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks incomplete, off-cadence, duplicate and zero-capacity records explicitly", async () => {
    setup([
      { start_date: "2026-02-02", story_points: 50 },
      { start_date: "2026-02-16", story_points: 30 },
    ]);
    const date = screen.getAllByLabelText("Sprint start")[1]!;
    for (const [value, error] of [
      ["2026-03-02", "Only completed sprints"],
      ["2026-02-17", "every 14 days"],
      ["2026-02-02", "only once"],
    ]) {
      fireEvent.change(date, { target: { value } });
      expect(screen.getByRole("alert")).toHaveTextContent(error!);
      expect(screen.getByRole("button", { name: "Save calibration" })).toBeDisabled();
    }
  });

  it("surfaces persistence errors and preserves the editable draft", async () => {
    const { onSave, onClose } = setup([{ start_date: "2026-02-02", story_points: 50 }]);
    onSave.mockRejectedValue(new Error("Save failed"));
    await userEvent.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Save failed"));
    expect(screen.getByLabelText("Delivered story points")).toHaveValue(50);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not claim a valid average when a historical sprint has no available team", () => {
    setup([{ start_date: "2026-02-02", story_points: 50 }], false);
    expect(screen.getByRole("alert")).toHaveTextContent("no available capacity");
    expect(screen.getByRole("button", { name: "Save calibration" })).toBeDisabled();
  });
});
