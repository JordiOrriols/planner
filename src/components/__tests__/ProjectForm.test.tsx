import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectForm from "@/components/organisms/project-form";
import { EMPTY_PROJECT } from "@/types/planner";

describe("Feature form footer actions", () => {
  it("places primary save beside discard and submits the associated form", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ProjectForm
        open
        initial={{ ...EMPTY_PROJECT, name: "Checkout" }}
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
        ...EMPTY_PROJECT,
        name: "Checkout",
      })
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("discards changes without saving", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ProjectForm open initial={null} onSave={onSave} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("Name"), "Draft");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps failed saves open and displays the error", async () => {
    const onClose = vi.fn();
    render(
      <ProjectForm
        open
        initial={{ ...EMPTY_PROJECT, name: "Checkout" }}
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
