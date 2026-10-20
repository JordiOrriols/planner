import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeatureForm from "@/components/organisms/feature-form";
import { EMPTY_FEATURE } from "@/types/planner";

const projects = [
  { id: "payments", workspace_id: "workspace", name: "Payments" },
  { id: "growth", workspace_id: "workspace", name: "Growth" },
];

describe("Feature form footer actions", () => {
  it("places primary save beside discard and submits the associated form", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "payments" }}
        projects={projects}
        onSave={onSave}
        onCreateProject={vi.fn()}
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
        project_id: "payments",
      })
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("orders fields as project, name, description, status, then estimates", () => {
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "payments" }}
        projects={projects}
        onSave={vi.fn()}
        onCreateProject={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const fields = ["Project", "Name", "Description", "Status"].map((label) =>
      screen.getByLabelText(label)
    );
    const estimates = screen.getByText("Role");
    for (const [index, field] of fields.entries()) {
      const next = fields[index + 1] ?? estimates;
      expect(field.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("assigns the feature to a project from the workspace list", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <FeatureForm
        open
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "growth" }}
        projects={projects}
        onSave={onSave}
        onCreateProject={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const select = screen.getByLabelText("Project");
    expect(select).toBeRequired();
    expect(select).toHaveValue("growth");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Choose a project", "Payments", "Growth", "+ New project"]);
    expect(screen.getByRole("option", { name: "Choose a project" })).toBeDisabled();
    await userEvent.selectOptions(select, "Payments");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: "payments" }))
    );
  });

  it("requires choosing a project before saving a new feature", async () => {
    const onSave = vi.fn();
    render(
      <FeatureForm
        open
        initial={null}
        projects={projects}
        onSave={onSave}
        onCreateProject={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await userEvent.type(screen.getByLabelText("Name"), "Checkout");
    expect(screen.getByLabelText("Project")).toHaveValue("");
    expect(screen.getByLabelText("Project")).toBeInvalid();
    await userEvent.click(screen.getByRole("button", { name: "Create feature" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("creates a new project inline and saves the feature into it", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValue(undefined);
    const onCreateProject = vi
      .fn()
      .mockResolvedValue({ id: "platform", workspace_id: "workspace", name: "Platform" });
    const onClose = vi.fn();
    render(
      <FeatureForm
        open
        initial={null}
        projects={projects}
        onSave={onSave}
        onCreateProject={onCreateProject}
        onClose={onClose}
      />
    );
    await userEvent.type(screen.getByLabelText("Name"), "Checkout");
    await userEvent.selectOptions(screen.getByLabelText("Project"), "+ New project");
    await userEvent.type(screen.getByLabelText("New project name"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: "Create feature" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(onCreateProject).toHaveBeenCalledExactlyOnceWith("Platform");
    expect(screen.getByLabelText("Project")).toHaveValue("platform");
    expect(screen.queryByLabelText("New project name")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create feature" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onCreateProject).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Checkout", project_id: "platform" })
    );
  });

  it("starts with a new project when the workspace has none", () => {
    render(
      <FeatureForm
        open
        initial={null}
        onSave={vi.fn()}
        onCreateProject={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Project")).toHaveValue("__new_project__");
    expect(screen.getByLabelText("New project name")).toBeRequired();
  });

  it("discards changes without saving", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <FeatureForm
        open
        initial={null}
        onSave={onSave}
        onCreateProject={vi.fn()}
        onClose={onClose}
      />
    );
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
        initial={{ ...EMPTY_FEATURE, name: "Checkout", project_id: "payments" }}
        projects={projects}
        onSave={vi.fn().mockRejectedValue(new Error("Save failed"))}
        onCreateProject={vi.fn()}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Save failed"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Checkout");
  });
});
