import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import GanttChart from "@/components/organisms/gantt-chart";
import FeatureEstimateCard from "@/components/organisms/feature-estimate-card";
import { ROLE_COLORS } from "@/config/roleColors";
import { EMPTY_FEATURE, ROLES, type Feature } from "@/types/planner";

const feature: Feature = {
  ...EMPTY_FEATURE,
  id: "feature",
  workspace_id: "workspace",
  name: "Checkout",
  backend_devs: 1,
  backend_weeks: 1,
  frontend_devs: 1,
  frontend_weeks: 1,
  design_devs: 1,
  design_weeks: 1,
  qa_devs: 1,
  qa_weeks: 1,
  in_backlog: true,
  status: "pending",
  priority: 1,
};

describe("role colors", () => {
  it("uses the roadmap palette for roadmap legends and estimation badges", () => {
    const { container } = render(
      <>
        <GanttChart weeks={[]} schedule={[]} />
        <FeatureEstimateCard
          feature={feature}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          disabled={false}
          readOnly
        />
      </>
    );
    for (const role of ROLES) {
      const swatches = container.querySelectorAll(`[data-role-swatch="${role}"]`);
      expect(swatches.length).toBeGreaterThanOrEqual(2);
      for (const swatch of swatches)
        expect(swatch).toHaveClass(...ROLE_COLORS[role].className.split(" "));
    }
  });

  it("keeps chart hex colors in step with the roadmap Tailwind shades", () => {
    expect(ROLE_COLORS).toMatchObject({
      backend: { className: expect.stringContaining("sky-700"), hex: "#0369a1" },
      frontend: { className: expect.stringContaining("sky-400"), hex: "#38bdf8" },
      design: { className: expect.stringContaining("amber-500"), hex: "#f59e0b" },
      qa: { className: expect.stringContaining("emerald-600"), hex: "#059669" },
    });
  });
});
