import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicRoadmapView } from "@/pages/roadmap-link";

describe("nontechnical roadmap", () => {
  it("shows one continuous overall bar without roles, capacity or editing controls", () => {
    render(
      <PublicRoadmapView
        roadmap={{
          name: "Workspace",
          startDate: "2026-02-02",
          features: [
            {
              name: "Checkout",
              project: "Payments",
              start: "2026-02-02",
              end: "2026-02-20",
              complete: true,
              delivered: false,
            },
          ],
        }}
      />
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img")).toHaveAccessibleName("Checkout: Feb 2, 2026 to Feb 20, 2026");
    expect(screen.getByText("Payments")).toBeVisible();
    for (const role of ["Backend", "Frontend", "QA", "Design", "UAT"])
      expect(screen.queryByText(role)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("makes unavailable dates explicit instead of inventing a bar", () => {
    render(
      <PublicRoadmapView
        roadmap={{
          name: "Workspace",
          startDate: "2026-02-02",
          features: [
            {
              name: "Blocked",
              project: "Payments",
              start: null,
              end: null,
              complete: false,
              delivered: false,
            },
          ],
        }}
      />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Dates not yet available")).toBeVisible();
  });
});
