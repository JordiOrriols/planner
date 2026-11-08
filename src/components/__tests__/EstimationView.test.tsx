import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimationView from "@/components/organisms/estimation-view";
import { EMPTY_FEATURE } from "@/types/planner";

const feature = {
  ...EMPTY_FEATURE,
  id: "task",
  project_id: "project",
  name: "Task",
  description: "Private",
  in_backlog: false,
  priority: 0,
};
function show(canEdit: boolean, deleteFeature = vi.fn().mockResolvedValue(undefined)) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const repository = {
    deleteFeature,
    saveFeature: vi.fn(),
    createProject: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
  };
  render(
    <EstimationView
      workspace={{ id: "workspace" }}
      features={[feature]}
      projects={[{ id: "project", workspace_id: "workspace", name: "Project" }]}
      canEdit={canEdit}
      refresh={refresh}
      repository={repository}
    />
  );
  return { deleteFeature, refresh };
}
it("reuses private estimate cards without offering writes to viewers", () => {
  show(false);
  expect(screen.getByRole("article", { name: "Task" })).toHaveTextContent("Private");
  expect(screen.queryByRole("button", { name: "New feature" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Task" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete Task" })).not.toBeInTheDocument();
});
it("cancelling deletion never writes and failed deletion leaves the task and an unobscured error", async () => {
  const { deleteFeature, refresh } = show(
    true,
    vi.fn().mockRejectedValue(new Error("Dependency prevents deletion"))
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete Task" }));
  await userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" })
  );
  expect(deleteFeature).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Delete Task" }));
  await userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete", exact: true })
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Dependency prevents deletion");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Task" })).toBeVisible();
  expect(refresh).not.toHaveBeenCalled();
});
