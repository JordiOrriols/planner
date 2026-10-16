import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeatureForm from "@/components/organisms/feature-form";
import { EMPTY_FEATURE } from "@/types/planner";

describe("Feature form footer actions", () => {
  it("places primary save beside discard and submits the associated form", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout" }}
        onSave={onSave}
        onClose={onClose}
      />
    );
    const save = screen.getByRole("button", { name: "Save changes" });
    const discard = screen.getByRole("button", { name: "Discard" });
    expect(save.parentElement).toBe(discard.parentElement);
    expect(save).toHaveClass("bg-primary");
    expect(save.closest("form")).toBeNull();
    expect(save).toHaveAttribute("form", screen.getByLabelText("Name").closest("form")!.id);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await userEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith({
        ...EMPTY_FEATURE,
        name: "Checkout",
      })
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("assigns or clears the feature's project from the workspace list", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "growth" }}
        projects={[
          { id: "payments", workspace_id: "workspace", name: "Payments" },
          { id: "growth", workspace_id: "workspace", name: "Growth" },
        ]}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const select = screen.getByLabelText("Project");
    expect(select).toHaveValue("growth");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "No project",
      "Payments",
      "Growth",
    ]);
    await userEvent.selectOptions(select, "Payments");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: "payments" }))
    );
  });

  it("saves features without a project as null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "payments" }}
        projects={[{ id: "payments", workspace_id: "workspace", name: "Payments" }]}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText("Project"), "No project");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: null }))
    );
  });

  it("discards changes without saving", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FeatureForm open initial={null} onSave={onSave} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("Name"), "Draft");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps failed saves open and displays the error", async () => {
    const onClose = vi.fn();
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout" }}
        onSave={vi.fn().mockRejectedValue(new Error("Save failed"))}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Save failed"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Checkout");
  });
});
