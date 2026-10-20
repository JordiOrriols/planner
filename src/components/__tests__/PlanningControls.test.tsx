import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Backlog from "@/pages/backlog";
import Estimation from "@/pages/estimation";
import FeatureForm from "@/components/organisms/feature-form";
import { EMPTY_FEATURE, type Project, type Feature } from "@/types/planner";

const { toggleBacklog, reorder, setDelivered, setPlanStart, refresh, state } = vi.hoisted(() => ({
  toggleBacklog: vi.fn(),
  reorder: vi.fn(),
  setDelivered: vi.fn(),
  setPlanStart: vi.fn(),
  refresh: vi.fn(),
  state: {
    isOwner: true,
    canEditOverride: null as boolean | null,
    features: [] as Feature[],
    projects: [] as Project[],
    planStart: "2026-10-15",
  },
}));
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ repository: { toggleBacklog, reorder, setDelivered, setPlanStart } }),
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    ...state,
    canEdit: state.canEditOverride ?? state.isOwner,
    workspace: { id: "squad", plan_start_date: state.planStart },
    members: [],
    vacations: [],
    refresh,
  }),
}));
function renderBacklog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <Backlog />
    </MemoryRouter>,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.isOwner = true;
  state.canEditOverride = null;
  state.planStart = "2026-10-15";
  state.projects = [];
  setPlanStart.mockImplementation(async (_id: string, date: string) => {
    state.planStart = date;
  });
  state.features = [
    {
      ...EMPTY_FEATURE,
      id: "project",
      project_id: "payments",
      name: "Checkout",
      backend_devs: 1,
      backend_weeks: 1,
      in_backlog: false,
      delivered: false,
      priority: 0,
    },
  ];
  toggleBacklog.mockResolvedValue(undefined);
  reorder.mockResolvedValue(undefined);
  setDelivered.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
});
describe("Planner estimate and backlog controls", () => {
  it("uses identical label and value layout for every roadmap summary card", () => {
    renderBacklog();
    const cards = ["Squad size", "Plan starts", "Roadmap finishes"].map((name) =>
      screen.getByRole("region", { name })
    );
    const first = cards[0]!;
    for (const card of cards) {
      expect(card.className).toBe(first.className);
      expect(card.firstElementChild?.className).toBe(first.firstElementChild?.className);
      expect(within(card).getByRole("heading", { level: 2 }).className).toBe(
        within(first).getByRole("heading", { level: 2 }).className
      );
      expect(card.lastElementChild?.className).toBe(first.lastElementChild?.className);
    }
  });

  it("groups prioritized features in roadmap order before the unprioritized backlog", () => {
    const base = state.features[0]!;
    state.features = [
      { ...base, id: "later", name: "Later", in_backlog: true, priority: 2 },
      { ...base, id: "idea", name: "Idea", in_backlog: false },
      { ...base, id: "first", name: "First", in_backlog: true, priority: 1 },
    ];
    render(<Estimation />);
    const roadmap = screen.getByRole("region", { name: "Roadmap" });
    const backlog = screen.getByRole("region", { name: "Backlog" });
    expect(
      within(roadmap)
        .getAllByRole("heading", { level: 3 })
        .map((item) => item.textContent)
    ).toEqual(["First", "Later"]);
    expect(
      within(backlog)
        .getAllByRole("heading", { level: 3 })
        .map((item) => item.textContent)
    ).toEqual(["Idea"]);
    expect(backlog).toHaveTextContent("Not prioritized features.");
    for (const group of [roadmap, backlog]) {
      const list = within(group).getAllByRole("article")[0]!.parentElement!;
      expect(list).toHaveClass("flex", "flex-col");
      expect(list.className).not.toMatch(/grid-cols/);
    }
    expect(
      roadmap.compareDocumentPosition(backlog) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("allows shared editors to manage features and schedule without being owners", async () => {
    state.isOwner = false;
    state.canEditOverride = true;
    const rendered = render(<Estimation />);
    expect(screen.getByRole("button", { name: "New feature" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Checkout" })).toBeVisible();
    rendered.unmount();
    state.features[0]!.in_backlog = true;
    renderBacklog();
    await userEvent.click(screen.getByRole("button", { name: "Edit plan start" }));
    expect(screen.getByLabelText("Plan starts", { selector: "input" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add feature" })).toBeVisible();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark delivered" }));
    await waitFor(() => expect(setDelivered).toHaveBeenCalledWith("project", true));
  });

  it("calls estimates features and keeps backlog actions off the estimation page", () => {
    render(<Estimation />);
    expect(screen.getByRole("heading", { name: "Feature estimation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "New feature" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Checkout" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /backlog/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/microproject/i)).not.toBeInTheDocument();
  });

  it("labels features with their project and lets only editors manage projects", async () => {
    state.projects = [{ id: "payments", workspace_id: "squad", name: "Payments" }];
    state.features = state.features.map((feature) => ({
      ...feature,
      project_id: "payments",
    }));
    const rendered = render(<Estimation />);
    expect(screen.getByRole("heading", { name: "PaymentsCheckout" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Manage projects" }));
    expect(screen.getByRole("dialog", { name: "Projects" })).toBeVisible();
    expect(screen.getByLabelText("Rename Payments")).toHaveValue("Payments");
    rendered.unmount();
    state.isOwner = false;
    render(<Estimation />);
    expect(screen.queryByRole("button", { name: "Manage projects" })).not.toBeInTheDocument();
  });

  it("groups roadmap rows under project headings in priority order", () => {
    state.projects = [{ id: "payments", workspace_id: "squad", name: "Payments" }];
    state.features = state.features.map((feature) => ({
      ...feature,
      in_backlog: true,
      project_id: "payments",
    }));
    renderBacklog();
    expect(screen.getByRole("heading", { name: "Project: Payments" })).toBeVisible();
  });

  it("uses the saved workspace date and retains a changed start after page remount", async () => {
    state.planStart = "2026-02-02";
    const rendered = renderBacklog();
    expect(screen.getByRole("region", { name: "Plan starts" })).toHaveTextContent("Feb 2, 2026");
    expect(screen.queryByLabelText("Plan starts", { selector: "input" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit plan start" }));
    expect(screen.getByLabelText("Plan starts", { selector: "input" })).toHaveValue("2026-02-02");
    fireEvent.change(screen.getByLabelText("Plan starts", { selector: "input" }), {
      target: { value: "2026-03-02" },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(setPlanStart).toHaveBeenCalledExactlyOnceWith("squad", "2026-03-02");
    rendered.unmount();
    renderBacklog();
    expect(screen.getByRole("region", { name: "Plan starts" })).toHaveTextContent("Mar 2, 2026");
    expect(screen.queryByLabelText("Plan starts", { selector: "input" })).not.toBeInTheDocument();
  });

  it("shows save failures and restores the persisted date instead of implying it was saved", async () => {
    setPlanStart.mockRejectedValueOnce(new Error("Plan start could not be saved"));
    renderBacklog();
    await userEvent.click(screen.getByRole("button", { name: "Edit plan start" }));
    fireEvent.change(screen.getByLabelText("Plan starts", { selector: "input" }), {
      target: { value: "2026-03-02" },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Plan start could not be saved")
    );
    expect(screen.getByLabelText("Plan starts", { selector: "input" })).toHaveValue("2026-10-15");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disables date changes while saving and for workspace viewers", async () => {
    let finish!: () => void;
    setPlanStart.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const rendered = renderBacklog();
    await userEvent.click(screen.getByRole("button", { name: "Edit plan start" }));
    fireEvent.change(screen.getByLabelText("Plan starts", { selector: "input" }), {
      target: { value: "2026-03-02" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Plan starts", { selector: "input" })).toBeDisabled()
    );
    finish();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    rendered.unmount();
    state.isOwner = false;
    state.planStart = "2026-04-01";
    renderBacklog();
    expect(screen.queryByRole("button", { name: "Edit plan start" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Plan starts", { selector: "input" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Plan starts" })).toHaveTextContent("Apr 1, 2026");
  });
  it("requires integer steps and makes decimal input invalid for all roles", async () => {
    const save = vi.fn();
    render(<FeatureForm open initial={null} onClose={vi.fn()} onSave={save} />);
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
    await userEvent.click(screen.getAllByRole("button", { name: "Add feature" })[0]!);
    expect(screen.getByRole("dialog", { name: "Add feature to roadmap" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add feature to roadmap: Checkout" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(toggleBacklog).toHaveBeenCalledWith("squad", "project", true);
    expect(screen.getByRole("link", { name: "Create a new feature" })).toHaveAttribute("href", "/");
  });
  it("removes a selected estimate without deleting it", async () => {
    state.features[0]!.in_backlog = true;
    renderBacklog();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove from roadmap" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(toggleBacklog).toHaveBeenCalledWith("squad", "project", false);
  });
  it("shows add failures and leaves the picker open", async () => {
    toggleBacklog.mockRejectedValue(new Error("Only the owner can change the backlog"));
    renderBacklog();
    await userEvent.click(screen.getAllByRole("button", { name: "Add feature" })[0]!);
    await userEvent.click(screen.getByRole("button", { name: "Add feature to roadmap: Checkout" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Only the owner"));
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not expose selection actions to read-only members", () => {
    state.isOwner = false;
    renderBacklog();
    expect(screen.queryByRole("button", { name: "Add feature" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove from backlog: Checkout" })
    ).not.toBeInTheDocument();
  });
});

function selectBacklog() {
  const first = { ...state.features[0]!, in_backlog: true };
  state.features = [
    first,
    { ...first, id: "second", name: "Second", priority: 1 },
    { ...first, id: "third", name: "Third", priority: 2 },
    { ...first, id: "excluded", name: "Excluded", in_backlog: false },
  ];
}

function dragFeature(from: string, to: string) {
  const source = screen.getByRole("button", { name: `Reorder ${from}` });
  const target = screen.getByRole("button", { name: `Reorder ${to}` }).parentElement!;
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(source, { dataTransfer });
  return dataTransfer;
}

describe("inline schedule priority controls", () => {
  it("persists delivery, refreshes it, and allows undoing without changing backlog inclusion", async () => {
    selectBacklog();
    setDelivered.mockImplementation(async (id: string, delivered: boolean) => {
      state.features = state.features.map((p) => (p.id === id ? { ...p, delivered } : p));
    });
    const rendered = renderBacklog();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Reorder Checkout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark delivered" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(setDelivered).toHaveBeenCalledExactlyOnceWith("project", true);
    rendered.rerender(
      <MemoryRouter>
        <Backlog />
      </MemoryRouter>
    );
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Undo delivery" }));
    await waitFor(() => expect(setDelivered).toHaveBeenLastCalledWith("project", false));
    expect(toggleBacklog).not.toHaveBeenCalled();
    expect(reorder).not.toHaveBeenCalled();
  });

  it("surfaces delivery save failures instead of displaying successful delivery", async () => {
    selectBacklog();
    setDelivered.mockRejectedValueOnce(new Error("Delivery could not be saved"));
    renderBacklog();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark delivered" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Delivery could not be saved")
    );
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    expect(screen.getByRole("menuitem", { name: "Mark delivered" })).toBeVisible();
  });
  it("moves a dragged project upward and saves all selected IDs in their new order", async () => {
    selectBacklog();
    renderBacklog();
    const transfer = dragFeature("Third", "Checkout");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "third");
    expect(reorder).toHaveBeenCalledExactlyOnceWith("squad", ["third", "project", "second"]);
  });

  it("moves downward by insertion rather than swapping distant projects", async () => {
    selectBacklog();
    renderBacklog();
    dragFeature("Checkout", "Third");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(reorder).toHaveBeenCalledExactlyOnceWith("squad", ["second", "third", "project"]);
  });

  it("supports keyboard reordering, keeps focus, and ignores boundary moves", async () => {
    selectBacklog();
    renderBacklog();
    const first = screen.getByRole("button", { name: "Reorder Checkout" });
    first.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(reorder).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(reorder).toHaveBeenCalledWith("squad", ["second", "project", "third"]);
    expect(first).toHaveFocus();
    const last = screen.getByRole("button", { name: "Reorder Third" });
    last.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(reorder).toHaveBeenCalledOnce();
  });

  it("refreshes project order after persistence succeeds", async () => {
    selectBacklog();
    reorder.mockImplementation(async (_workspace: string, ids: string[]) => {
      state.features = state.features.map((feature) => ({
        ...feature,
        priority: ids.includes(feature.id) ? ids.indexOf(feature.id) : feature.priority,
      }));
    });
    const rendered = renderBacklog();
    dragFeature("Third", "Checkout");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    rendered.rerender(
      <MemoryRouter>
        <Backlog />
      </MemoryRouter>
    );
    expect(
      screen.getAllByRole("button", { name: /^Reorder / }).map((button) => button.textContent)
    ).toEqual(["Third", "Checkout", "Second"]);
  });

  it("ignores self-drops and external drops", () => {
    selectBacklog();
    renderBacklog();
    dragFeature("Checkout", "Checkout");
    fireEvent.drop(screen.getByRole("button", { name: "Reorder Third" }).parentElement!);
    expect(reorder).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("surfaces reorder failures without refreshing or changing the displayed order", async () => {
    selectBacklog();
    reorder.mockRejectedValue(new Error("Could not save priority"));
    renderBacklog();
    dragFeature("Third", "Checkout");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save priority")
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: /^Reorder / }).map((button) => button.textContent)
    ).toEqual(["Checkout", "Second", "Third"]);
  });

  it("disables reordering and removal while a priority save is pending", async () => {
    selectBacklog();
    let finish!: () => void;
    reorder.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    renderBacklog();
    dragFeature("Third", "Checkout");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reorder Checkout" })).toBeDisabled()
    );
    expect(screen.getByRole("button", { name: "Reorder Checkout" })).toHaveAttribute(
      "draggable",
      "false"
    );
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    expect(screen.getByRole("menuitem", { name: "Remove from roadmap" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("menuitem", { name: "Mark delivered" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await userEvent.keyboard("{Escape}");
    dragFeature("Checkout", "Third");
    expect(reorder).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Reorder Checkout" })).toBeEnabled();
  });

  it("does not render schedule mutation controls for viewers", () => {
    selectBacklog();
    state.isOwner = false;
    renderBacklog();
    expect(screen.getByRole("region", { name: "Feature schedule" })).toHaveTextContent("Checkout");
    expect(screen.queryByRole("button", { name: /^Reorder / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove from backlog:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mark delivered:/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Drag feature names/)).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("preserves removal controls when invalid estimates prevent computing the forecast", async () => {
    selectBacklog();
    state.features[0]!.backend_weeks = 1.5;
    renderBacklog();
    expect(screen.getByRole("alert")).toHaveTextContent("whole numbers");
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove from roadmap" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(toggleBacklog).toHaveBeenCalledWith("squad", "project", false);
  });

  it("surfaces removal failures and keeps the project in the schedule", async () => {
    selectBacklog();
    toggleBacklog.mockRejectedValue(new Error("Could not remove project"));
    renderBacklog();
    fireEvent.contextMenu(screen.getByLabelText("Schedule row: Checkout"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove from roadmap" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not remove project")
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reorder Checkout" })).toBeInTheDocument();
  });
});
