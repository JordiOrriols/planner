import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import type { PublicRoadmap } from "@/lib/publicRoadmap";

const { loadRoadmapLink } = vi.hoisted(() => ({ loadRoadmapLink: vi.fn() }));
vi.mock("@/data/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/data/plannerRepository", () => ({
  createPlannerRepository: () => ({ loadRoadmapLink }),
}));

const { default: RoadmapLink, PublicRoadmapView } = await import("@/pages/roadmap-link");

type Item = PublicRoadmap["features"][number];
const checkout: Item = {
  name: "Checkout",
  project: "Payments",
  start: "2026-02-02",
  end: "2026-02-20",
  complete: true,
  status: "pending",
};
const roadmap = (...features: Item[]): PublicRoadmap => ({
  name: "Workspace",
  startDate: "2026-02-02",
  markers: [],
  features,
});

beforeEach(() => {
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
  function renderPage() {
    loadRoadmapLink.mockResolvedValue(roadmap(checkout));
    return render(
      <QueryClientProvider client={new QueryClient()}>
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
});
