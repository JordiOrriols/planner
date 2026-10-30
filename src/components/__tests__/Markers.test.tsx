import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import MarkersManager from "@/components/organisms/markers-manager";
import { MarkerVisibilityButton, TimelineGuides } from "@/components/organisms/roadmap-timeline";
import { useMarkerVisibility } from "@/lib/roadmapDisplay";

const marker = { id: "marker", workspace_id: "workspace", name: "Launch", date: "2026-02-04" };
const weeks = [new Date(2026, 1, 2), new Date(2026, 1, 9)];
beforeEach(() => sessionStorage.clear());

function Visibility({ publicView = false }: { publicView?: boolean }) {
  const { visible, toggle } = useMarkerVisibility(publicView);
  return (
    <>
      <MarkerVisibilityButton visible={visible} onToggle={toggle} />
      <TimelineGuides weekStarts={weeks} labelWidth={220} markers={visible ? [marker] : []} />
    </>
  );
}

describe("roadmap markers", () => {
  it("positions exact calendar days, including weekends, and excludes out-of-range markers", () => {
    render(
      <TimelineGuides
        weekStarts={weeks}
        labelWidth={220}
        markers={[
          marker,
          { name: "Weekend", date: "2026-02-08" },
          { name: "Before", date: "2026-02-01" },
          { name: "After", date: "2026-02-16" },
          { name: "Same day", date: marker.date },
        ]}
      />
    );
    expect(
      parseFloat(screen.getByRole("img", { name: "Launch: Feb 4, 2026" }).style.left)
    ).toBeCloseTo((2.5 / 14) * 100);
    expect(
      parseFloat(screen.getByRole("img", { name: "Weekend: Feb 8, 2026" }).style.left)
    ).toBeCloseTo((6.5 / 14) * 100);
    expect(screen.getByRole("img", { name: "Same day: Feb 4, 2026" })).toBeVisible();
    expect(screen.queryByRole("img", { name: /Before|After/ })).not.toBeInTheDocument();
  });

  it("defaults on for members and off for public links, retaining independent tab-session choices", async () => {
    let view = render(<Visibility />);
    expect(screen.getByRole("img", { name: /Launch:/ })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Hide markers" }));
    expect(screen.queryByRole("img", { name: /Launch:/ })).not.toBeInTheDocument();
    view.unmount();
    view = render(<Visibility />);
    expect(screen.getByRole("button", { name: "Show markers" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    view.unmount();
    view = render(<Visibility publicView />);
    expect(screen.getByRole("button", { name: "Show markers" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Show markers" }));
    expect(screen.getByRole("img", { name: /Launch:/ })).toBeVisible();
    view.unmount();
    view = render(<Visibility publicView />);
    expect(screen.getByRole("button", { name: "Hide markers" })).toBeVisible();
    view.unmount();
    sessionStorage.clear();
    render(<Visibility />);
    expect(screen.getByRole("button", { name: "Hide markers" })).toBeVisible();
    expect(localStorage.getItem("planner:markers:member:v1")).toBeNull();
  });

  it("creates and deletes markers through the modal list", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <MarkersManager
        markers={[marker]}
        onClose={vi.fn()}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    );
    expect(screen.getByRole("button", { name: "Add marker" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Marker name"), "Release");
    fireEvent.change(screen.getByLabelText("Marker date"), { target: { value: "2026-02-06" } });
    await userEvent.click(screen.getByRole("button", { name: "Add marker" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledExactlyOnceWith("Release", "2026-02-06"));
    expect(screen.getByLabelText("Marker name")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Delete marker Launch" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith("marker"));
  });

  it("keeps inputs and surfaces failures instead of claiming success", async () => {
    render(
      <MarkersManager
        markers={[marker]}
        onClose={vi.fn()}
        onCreate={vi.fn().mockRejectedValue(new Error("Cannot save"))}
        onDelete={vi.fn().mockRejectedValue(new Error("Cannot delete"))}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete marker Launch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot delete");
    await userEvent.type(screen.getByLabelText("Marker name"), "Release");
    fireEvent.change(screen.getByLabelText("Marker date"), { target: { value: "2026-02-06" } });
    await userEvent.click(screen.getByRole("button", { name: "Add marker" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cannot save"));
    expect(screen.getByLabelText("Marker name")).toHaveValue("Release");
  });
});
