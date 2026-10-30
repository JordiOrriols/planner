import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import ProjectsManager from "@/components/organisms/projects-manager";

const projects = [
  { id: "payments", workspace_id: "workspace", name: "Payments" },
  { id: "growth", workspace_id: "workspace", name: "Growth" },
];

function setup(overrides: Partial<React.ComponentProps<typeof ProjectsManager>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    projects,
    projectsInUse: new Set<string>(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<ProjectsManager {...props} />);
  return props;
}

describe("Projects manager", () => {
  it("creates a project and clears the name field", async () => {
    const props = setup();
    const name = screen.getByLabelText("New project name");
    await userEvent.type(name, "Platform");
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledExactlyOnceWith("Platform"));
    await waitFor(() => expect(name).toHaveValue(""));
  });

  it("renames only after a change and deletes projects individually", async () => {
    const props = setup();
    expect(screen.queryByRole("button", { name: "Save Payments" })).not.toBeInTheDocument();
    const field = screen.getByLabelText("Rename Payments");
    await userEvent.clear(field);
    await userEvent.type(field, "Billing");
    await userEvent.click(screen.getByRole("button", { name: "Save Payments" }));
    await waitFor(() =>
      expect(props.onRename).toHaveBeenCalledExactlyOnceWith("payments", "Billing")
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Growth" }));
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledExactlyOnceWith("growth"));
  });

  it("blocks deleting a project that still has features", async () => {
    setup({ projectsInUse: new Set(["payments"]) });
    const deletePayments = screen.getByRole("button", { name: "Delete Payments" });
    expect(deletePayments).toBeDisabled();
    await userEvent.hover(deletePayments);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Delete or move this project's features first."
    );
    expect(screen.getByRole("button", { name: "Delete Growth" })).toBeEnabled();
  });

  it("shows an empty state and surfaces failures", async () => {
    setup({ projects: [], onCreate: vi.fn().mockRejectedValue(new Error("Name already used")) });
    expect(screen.getByText("No projects yet.")).toBeVisible();
    await userEvent.type(screen.getByLabelText("New project name"), "Dup");
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name already used");
  });
});
