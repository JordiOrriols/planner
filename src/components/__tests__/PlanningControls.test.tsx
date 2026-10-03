import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Backlog from "@/pages/backlog";
import ProjectForm from "@/components/organisms/project-form";
import { EMPTY_PROJECT, type Project } from "@/types/planner";

const { toggleBacklog, refresh, state } = vi.hoisted(() => ({
  toggleBacklog: vi.fn(),
  refresh: vi.fn(),
  state: { isOwner: true, projects: [] as Project[] },
}));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ repository: { toggleBacklog } }),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    ...state,
    workspace: { id: "squad" },
    members: [],
    availability: [],
    refresh,
  }),
}));
function renderBacklog() {
  return render(
    <MemoryRouter>
      <Backlog />
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.isOwner = true;
  state.projects = [
    {
      ...EMPTY_PROJECT,
      id: "project",
      workspace_id: "squad",
      name: "Checkout",
      backend_devs: 1,
      backend_weeks: 1,
      in_backlog: false,
      priority: 0,
    },
  ];
  toggleBacklog.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
});
describe("Planner estimate and backlog controls", () => {
  it("requires integer steps and makes decimal input invalid for all roles", async () => {
    const save = vi.fn();
    render(<ProjectForm open initial={null} onClose={vi.fn()} onSave={save} />);
    for (const role of ["Backend", "Frontend", "Design", "QA"]) {
      for (const field of ["people", "weeks"]) {
        const input = screen.getByRole("spinbutton", { name: `${role} ${field}` });
        expect(input).toHaveAttribute("step", "1");
        await userEvent.clear(input);
        await userEvent.type(input, "1.5");
        expect(input).toBeInvalid();
        await userEvent.clear(input);
        await userEvent.type(input, "1");
        expect(input).toBeValid();
      }
    }
    expect(save).not.toHaveBeenCalled();
  });
  it("adds an existing estimate directly from an empty backlog", async () => {
    renderBacklog();
    await userEvent.click(screen.getAllByRole("button", { name: "Add projects" })[0]!);
    expect(screen.getByRole("dialog", { name: "Add projects to backlog" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add to backlog: Checkout" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(toggleBacklog).toHaveBeenCalledWith("squad", "project", true);
    expect(screen.getByRole("link", { name: "Create a new estimate" })).toHaveAttribute(
      "href",
      "/"
    );
  });
  it("removes a selected estimate without deleting it", async () => {
    state.projects[0]!.in_backlog = true;
    renderBacklog();
    await userEvent.click(screen.getByRole("button", { name: "Remove from backlog: Checkout" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(toggleBacklog).toHaveBeenCalledWith("squad", "project", false);
  });
  it("shows add failures and leaves the picker open", async () => {
    toggleBacklog.mockRejectedValue(new Error("Only the owner can change the backlog"));
    renderBacklog();
    await userEvent.click(screen.getAllByRole("button", { name: "Add projects" })[0]!);
    await userEvent.click(screen.getByRole("button", { name: "Add to backlog: Checkout" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Only the owner"));
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not expose selection actions to read-only members", () => {
    state.isOwner = false;
    renderBacklog();
    expect(screen.queryByRole("button", { name: "Add projects" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove from backlog: Checkout" })
    ).not.toBeInTheDocument();
  });
});
