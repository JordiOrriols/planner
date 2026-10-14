import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import type { Availability } from "@/types/planner";

const ada = { id: "ada", name: "Ada", role: "backend" as const };
const grace = { id: "grace", name: "Grace", role: "frontend" as const };

function open({
  canEdit = true,
  save = vi.fn().mockResolvedValue(undefined),
  availability = [] as Availability[],
  initialMonth = new Date(2026, 10, 1),
} = {}) {
  function Editor() {
    const [month, setMonth] = useState(initialMonth);
    return (
      <AvailabilityEditor
        member={ada}
        members={[ada, grace]}
        availability={availability}
        month={month}
        onMonthChange={setMonth}
        canEdit={canEdit}
        save={save}
      />
    );
  }
  render(<Editor />);
  return { save };
}
const day = (date: string) => screen.getByRole("button", { name: new RegExp(`^${date}( |$)`) });

describe("Shared vacation calendar editor", () => {
  it("uses only calendar selection and two one-click actions", async () => {
    const { save } = open();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save availability" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working Day" })).toBeDisabled();
    await userEvent.click(day("2026-11-02"));
    await userEvent.click(day("2026-11-04"));
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"])
      expect(day(date)).toHaveAttribute("aria-pressed", "true");
    expect(day("2026-11-05")).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledExactlyOnceWith("2026-11-02", "2026-11-04", false)
    );
    expect(day("2026-11-03")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("2026-11-02", "2026-11-04", true));
  });

  it("normalizes reverse selection and starts a fresh range on the third click", async () => {
    const { save } = open();
    await userEvent.click(day("2026-11-04"));
    await userEvent.click(day("2026-11-02"));
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("2026-11-02", "2026-11-04", true));
    await userEvent.click(day("2026-11-09"));
    expect(day("2026-11-03")).toHaveAttribute("aria-pressed", "false");
    expect(day("2026-11-09")).toHaveAttribute("aria-pressed", "true");
  });

  it("can save a single day and preserves that selection while starting the next range", async () => {
    const { save } = open();
    await userEvent.click(day("2026-11-02"));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("2026-11-02", "2026-11-02", false));
    expect(day("2026-11-02")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(day("2026-11-04"));
    await userEvent.click(day("2026-11-05"));
    await userEvent.click(screen.getByRole("button", { name: "Working Day" }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("2026-11-04", "2026-11-05", true));
  });

  it("keeps cross-month selection highlighted after navigation and saving", async () => {
    const { save } = open();
    await userEvent.click(day("2026-11-27"));
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(day("2026-12-03"));
    expect(day("2026-12-01")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("2026-11-27", "2026-12-03", false));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(day("2026-11-27")).toHaveAttribute("aria-pressed", "true");
    expect(day("2026-11-30")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(day("2026-11-27")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
  });

  it("retains selection on failure and disables all writes while saving", async () => {
    let fail!: (error: Error) => void;
    const save = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        })
    );
    open({ save });
    await userEvent.click(day("2026-11-02"));
    await userEvent.click(day("2026-11-03"));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    expect(screen.getByRole("button", { name: "Working Day" })).toBeDisabled();
    expect(day("2026-11-04")).toBeDisabled();
    fail(new Error("Save failed"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(day("2026-11-02")).toHaveAttribute("aria-pressed", "true");
    expect(day("2026-11-03")).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveBeenCalledOnce();
  });

  it("shows vacation names, initials and matching legend colors, not ordinary non-working days", () => {
    open({
      availability: [
        { member_id: "ada", date: "2026-11-02", is_working: false },
        { member_id: "grace", date: "2026-11-02", is_working: false },
        { member_id: "grace", date: "2026-11-03", is_working: true },
      ],
    });
    const adaMarker = within(day("2026-11-02")).getByLabelText("Ada: vacation");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-11-02: Not working")).not.toBeInTheDocument();
    const graceMarker = within(day("2026-11-02")).getByLabelText("Grace: vacation");
    expect(adaMarker).toHaveTextContent("AAda");
    expect(graceMarker).toHaveTextContent("GGrace");
    expect(adaMarker).toHaveAttribute("title", "Ada: vacation");
    const legend = screen.getByLabelText("Team vacation legend");
    expect(legend).toHaveTextContent("Ada");
    expect(legend).toHaveTextContent("Grace");
    expect(adaMarker.firstElementChild?.className).toContain(
      within(legend)
        .getByText("A", { exact: true })
        .className.split(" ")
        .find((c) => c.startsWith("bg-"))!
    );
    expect(within(day("2026-11-03")).queryByLabelText("Grace: vacation")).not.toBeInTheDocument();
    expect(within(day("2026-11-07")).queryByLabelText(/vacation/)).not.toBeInTheDocument();
  });

  it("keeps read-only calendars visible without permitting selection or writes", () => {
    const { save } = open({
      canEdit: false,
      availability: [{ member_id: "ada", date: "2026-11-02", is_working: false }],
    });
    expect(day("2026-11-02")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vacations", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working Day" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Restore calendar default/ })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ada: vacation")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects an overlong cross-year range before saving and disables unverified dates", async () => {
    const { save } = open({ initialMonth: new Date(2026, 0, 1) });
    await userEvent.click(day("2026-01-02"));
    for (let i = 0; i < 12; i++)
      await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(day("2027-01-04"));
    await userEvent.click(screen.getByRole("button", { name: "Vacations", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at most 366 days");
    expect(save).not.toHaveBeenCalled();
  });
});
