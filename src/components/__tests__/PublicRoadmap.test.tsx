import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

const { loadRoadmapLink, listPriorityProposals, savePriorityProposal, authUser } = vi.hoisted(
  () => ({
    loadRoadmapLink: vi.fn(),
    listPriorityProposals: vi.fn(),
    savePriorityProposal: vi.fn(),
    authUser: vi.fn(),
  })
);
vi.mock("@/data/DataProvider", () => ({
  useData: () => ({ user: authUser(), authEnabled: true, signOut: vi.fn() }),
}));
vi.mock("@/data/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/data/plannerRepository", () => ({
  createPlannerRepository: () => ({ loadRoadmapLink, listPriorityProposals, savePriorityProposal }),
}));

const { default: RoadmapLink, PublicRoadmapView } = await import("@/pages/roadmap-link");

type Item = PublicRoadmap["features"][number];
const checkout: Item = {
  id: "11111111-1111-4111-8111-111111111111",
  dependency_ids: [],
  name: "Checkout",
  project: "Payments",
  start: "2026-02-02",
  end: "2026-02-20",
  complete: true,
  status: "pending",
};
const roadmap = (...features: Item[]): PublicRoadmap => ({
  revision: "a".repeat(32),
  name: "Workspace",
  startDate: "2026-02-02",
  markers: [],
  features,
});

beforeEach(() => {
  vi.clearAllMocks();
  authUser.mockReturnValue(null);
  listPriorityProposals.mockResolvedValue([]);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(async () => {
  vi.useRealTimers();
  await i18n.changeLanguage("en");
});

describe("nontechnical roadmap", () => {
  it("groups consecutive projects without changing feature priority, including repeated and missing projects", () => {
    render(
      <PublicRoadmapView
        roadmap={roadmap(
          checkout,
          { ...checkout, name: "Billing" },
          { ...checkout, name: "Search", project: "Discovery" },
          { ...checkout, name: "Exports" },
          { ...checkout, name: "Other", project: "" }
        )}
      />
    );
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.getAttribute("aria-label"))
    ).toEqual([
      "Project: Payments",
      "Project: Discovery",
      "Project: Payments",
      "Project: No project",
    ]);
    expect(
      screen
        .getAllByRole("img", { name: /to Feb 20/ })
        .map((bar) => bar.getAttribute("aria-label")?.split(":")[0])
    ).toEqual(["Checkout", "Billing", "Search", "Exports", "Other"]);
  });
  it("omits project headings when all project names are missing", () => {
    render(<PublicRoadmapView roadmap={roadmap({ ...checkout, project: "" })} />);
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });
  it("shows one continuous overall bar without roles, capacity or editing controls", () => {
    render(<PublicRoadmapView roadmap={roadmap(checkout)} />);
    expect(screen.getByRole("img", { name: /^Checkout:/ })).toHaveAccessibleName(
      "Checkout: Feb 2, 2026 to Feb 20, 2026 · Pending"
    );
    expect(screen.getByRole("heading", { name: "Project: Payments" })).toBeVisible();
    expect(screen.getAllByText("Payments", { exact: true })).toHaveLength(1);
    for (const role of ["Backend", "Frontend", "QA", "Design", "UAT"])
      expect(screen.queryByText(role)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Roadmap display" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Full width", "Wrap titles", "Show markers"]);
    for (const button of within(
      screen.getByRole("group", { name: "Roadmap display" })
    ).getAllByRole("button"))
      expect(button).toHaveTextContent("");
  });

  it("makes unavailable dates explicit instead of inventing a bar", () => {
    render(<PublicRoadmapView roadmap={roadmap({ ...checkout, start: null, end: null })} />);
    expect(screen.queryByRole("img", { name: /^Checkout:/ })).not.toBeInTheDocument();
    expect(screen.getByText("Dates not yet available")).toBeVisible();
  });

  it("colours each bar by status, without status dots, and dims paused ones", () => {
    render(
      <PublicRoadmapView
        roadmap={roadmap(
          checkout,
          { ...checkout, name: "Search", status: "in_progress" },
          { ...checkout, name: "Billing", status: "done" },
          { ...checkout, name: "Exports", status: "paused" }
        )}
      />
    );
    expect(screen.queryByRole("img", { name: /^Status: / })).not.toBeInTheDocument();
    for (const status of ["Pending", "In progress", "Done", "Paused"])
      expect(screen.getByText(status, { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Checkout:.* · Pending$/ })).toHaveClass(
      "bg-slate-400"
    );
    expect(screen.getByRole("img", { name: /^Search:.* · In progress$/ })).toHaveClass(
      "bg-blue-500"
    );
    expect(screen.getByRole("img", { name: /^Billing:.* · Done$/ })).toHaveClass("bg-emerald-600");
    const paused = screen.getByRole("img", { name: /^Exports:.* · Paused$/ });
    expect(paused).toHaveClass("bg-amber-500", "opacity-50");
    expect(screen.getByRole("img", { name: /^Checkout:/ })).not.toHaveClass("opacity-50");
  });

  it("shows today plus light weekly lines and stronger month boundaries", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 1, 4, 12));
    const { container } = render(<PublicRoadmapView roadmap={roadmap(checkout)} />);
    const today = screen.getByRole("img", { name: "Today: Feb 4, 2026" });
    expect(parseFloat(today.style.left)).toBeCloseTo((2.5 / 28) * 100);
    expect(container.querySelectorAll('[data-guide="week"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-guide="month"]')).toHaveLength(0);
    const long = render(
      <PublicRoadmapView roadmap={roadmap({ ...checkout, end: "2026-03-20" })} />
    ).container;
    const month = long.querySelectorAll<HTMLElement>('[data-guide="month"]');
    expect(month).toHaveLength(1);
    expect(month[0]).toHaveClass("border-slate-400/60");
    expect(parseFloat(month[0]!.style.left)).toBeCloseTo((4 / 7) * 100);
  });

  it("toggles full width and title wrapping, remembering the choice", async () => {
    const long = "A very long feature name that would not fit in the narrow column";
    const { container, unmount } = render(
      <PublicRoadmapView roadmap={roadmap({ ...checkout, name: long })} />
    );
    const title = screen.getByTitle(long);
    expect(title).toHaveClass("truncate");
    await userEvent.click(screen.getByRole("button", { name: "Wrap titles" }));
    expect(screen.getByRole("button", { name: "Wrap titles" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(title).toHaveClass("whitespace-normal");
    expect(title).not.toHaveClass("truncate");
    const row = container.querySelector<HTMLElement>('[style*="grid-template-columns: 220px"]');
    expect(row).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Full width" }));
    expect(container.querySelector('[style*="grid-template-columns: 300px"]')).not.toBeNull();
    unmount();
    render(<PublicRoadmapView roadmap={roadmap(checkout)} />);
    expect(screen.getByRole("button", { name: "Full width" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

describe("public roadmap page", () => {
  function renderPage(data = roadmap(checkout), client = new QueryClient()) {
    loadRoadmapLink.mockResolvedValue(data);
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/roadmap/token"]}>
          <Routes>
            <Route path="/roadmap/:token" element={<RoadmapLink />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("lets visitors change the language and keeps the footer", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeVisible();
    expect(screen.getByTestId("app-footer")).toHaveTextContent("Made with love by Jordi Orriols");
    await userEvent.click(screen.getByRole("button", { name: "Language" }));
    await userEvent.click(await screen.findByTestId("language-button-es"));
    expect(await screen.findByRole("button", { name: "Ancho completo" })).toBeVisible();
    expect(screen.getByTestId("app-footer")).toHaveTextContent("Hecho con amor por Jordi Orriols");
  });

  it("removes the page width limit in full-width mode", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Workspace" });
    expect(screen.getByRole("main")).toHaveClass("max-w-7xl");
    await userEvent.click(screen.getByRole("button", { name: "Full width" }));
    expect(screen.getByRole("main")).toHaveClass("max-w-none");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-7xl");
  });

  it("recalculates a local move and resets without saving official priorities", async () => {
    const second = { ...checkout, id: "22222222-2222-4222-8222-222222222222", name: "Search" };
    const official = roadmap(checkout, second);
    renderPage(official);
    await screen.findByRole("button", { name: "Reorder Search" });
    loadRoadmapLink.mockResolvedValueOnce(roadmap(second, checkout));
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Search" }), { key: "ArrowUp" });
    expect(
      await screen.findByText("Temporary experiment. The official priorities have not changed.")
    ).toBeVisible();
    expect(loadRoadmapLink).toHaveBeenLastCalledWith("token", {
      featureIds: [second.id, checkout.id],
      expectedRevision: official.revision,
    });
    expect(savePriorityProposal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Return to official plan" }));
    expect(
      screen.queryByText("Temporary experiment. The official priorities have not changed.")
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Propose priority" }));
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  it("blocks dependency violations with feature names before requesting a preview", async () => {
    const dependent = {
      ...checkout,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Search",
      dependency_ids: [checkout.id!],
    };
    renderPage(roadmap(checkout, dependent));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Reorder Search" }), {
      key: "ArrowUp",
    });
    expect(
      await screen.findByText('"Search" must come after its dependency "Checkout".')
    ).toBeVisible();
    expect(loadRoadmapLink).toHaveBeenCalledTimes(1);
    expect(screen.getByText("After: Checkout")).toBeVisible();
  });

  it("saves a named authenticated proposal and reopens its immutable snapshot", async () => {
    authUser.mockReturnValue({ id: "owner", email: "owner@example.com" });
    const proposal = "33333333-3333-4333-8333-333333333333";
    savePriorityProposal.mockResolvedValue(proposal);
    renderPage();
    await screen.findByRole("heading", { name: "Workspace" });
    listPriorityProposals.mockResolvedValue([
      { id: proposal, name: "Alternative", created_at: "2026-11-06T00:00:00Z" },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Propose priority" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Proposal name" }),
      "Alternative"
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Propose priority" }));
    expect(await screen.findByText(/Saved snapshot: dates/)).toBeVisible();
    expect(savePriorityProposal).toHaveBeenCalledWith(
      "token",
      "Alternative",
      [checkout.id],
      "a".repeat(32)
    );
    expect(loadRoadmapLink).toHaveBeenLastCalledWith("token", { proposal });
    expect(screen.queryByRole("button", { name: "Reorder Checkout" })).not.toBeInTheDocument();
  });

  it("keeps the entire locked prefix fixed, including pending work ahead of active work", () => {
    const move = vi.fn();
    render(
      <PublicRoadmapView
        onMove={move}
        roadmap={roadmap(
          checkout,
          { ...checkout, id: "active", name: "Active", status: "in_progress" },
          { ...checkout, id: "later", name: "Later", status: "paused" },
          { ...checkout, id: "last", name: "Last" }
        )}
      />
    );
    expect(screen.queryByRole("button", { name: "Reorder Checkout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reorder Active" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Later" }), { key: "ArrowUp" });
    expect(move).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Later" }), { key: "ArrowDown" });
    expect(move).toHaveBeenCalledWith("later", "last");
    expect(screen.queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
  });

  it("preserves the draft during live changes and disables stale saves until reset", async () => {
    const client = new QueryClient();
    const second = { ...checkout, id: "22222222-2222-4222-8222-222222222222", name: "Search" };
    const official = roadmap(checkout, second);
    renderPage(official, client);
    await screen.findByRole("button", { name: "Reorder Search" });
    loadRoadmapLink.mockResolvedValueOnce(roadmap(second, checkout));
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Search" }), { key: "ArrowUp" });
    await screen.findByText("Temporary experiment. The official priorities have not changed.");
    loadRoadmapLink.mockRejectedValueOnce(new Error("Connection unavailable"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["public-roadmap", "token"] });
    });
    expect(await screen.findByText("Connection unavailable")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Experiment", exact: true })).toBeVisible();
    await act(async () => {
      client.setQueryData(["public-roadmap", "token"], { ...official, revision: "b".repeat(32) });
    });
    expect(await screen.findByText(/roadmap has changed or cannot be reordered/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Experiment", exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Propose priority" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Return to official plan" }));
    expect(
      screen.queryByRole("heading", { name: "Experiment", exact: true })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Propose priority" })).toBeEnabled();
  });

  it("compares an anonymous saved snapshot with the official plan without exposing reordering", async () => {
    const proposal = "33333333-3333-4333-8333-333333333333";
    listPriorityProposals.mockResolvedValue([
      { id: proposal, name: "Alternative", created_at: "2026-11-06T00:00:00Z" },
    ]);
    renderPage();
    await screen.findByRole("heading", { name: "Workspace" });
    await userEvent.click(screen.getByLabelText("View saved proposal"));
    await userEvent.click(await screen.findByRole("option", { name: "Alternative", exact: true }));
    expect(await screen.findByRole("heading", { name: "Alternative", exact: true })).toBeVisible();
    await userEvent.click(screen.getByLabelText("Compare with"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Official plan", exact: true })
    );
    expect(
      await screen.findByRole("heading", { name: "Official plan", exact: true })
    ).toBeVisible();
    expect(screen.getAllByRole("img", { name: /^Checkout:/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Reorder Checkout" })).not.toBeInTheDocument();
    expect(savePriorityProposal).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Try these priorities on the current plan" })
    );
    expect(await screen.findByRole("heading", { name: "Experiment", exact: true })).toBeVisible();
    expect(loadRoadmapLink).toHaveBeenLastCalledWith("token", {
      featureIds: [checkout.id],
      expectedRevision: "a".repeat(32),
    });
    expect(savePriorityProposal).not.toHaveBeenCalled();
  });
});
