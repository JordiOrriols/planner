import { ROLE_COLORS } from "@/config/roleColors";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APP_LANGUAGES } from "@jordiorriols/ui";
import FeatureEstimateCard from "@/components/organisms/feature-estimate-card";
import i18n from "@/i18n";
import { EMPTY_FEATURE, ROLES, type Feature } from "@/types/planner";

const feature: Feature = {
  ...EMPTY_FEATURE,
  id: "feature",
  workspace_id: "workspace",
  name: "Checkout",
  description: "A readable feature estimate",
  backend_devs: 2,
  backend_weeks: 3,
  frontend_devs: 1,
  frontend_weeks: 2,
  design_devs: 1,
  design_weeks: 1,
  qa_devs: 2,
  qa_weeks: 1,
  in_backlog: false,
  delivered: false,
  priority: 0,
};

function renderCard(input = feature, readOnly = false) {
  return render(
    <FeatureEstimateCard
      feature={input}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      disabled={false}
      readOnly={readOnly}
    />
  );
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("Feature estimate breakdown", () => {
  it.each(APP_LANGUAGES.map(({ code }) => code))(
    "shows accurate role estimates and overall metrics in %s",
    async (language) => {
      await i18n.changeLanguage(language);
      const t = i18n.getFixedT(language);
      renderCard();
      const card = screen.getByRole("article", { name: feature.name });
      expect(within(card).queryByRole("region")).not.toBeInTheDocument();
      const toggle = screen.getByRole("button", { name: t("featureCard.showDetails") });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(
        within(card)
          .getAllByText(t("common.units.personWeeksShort"))
          .filter((element) => !element.closest("[hidden]"))
      ).toHaveLength(5);
      const roleEffort = within(card).getByRole("group", { name: t("featureCard.roleEffort") });
      for (const role of ROLES)
        expect(
          within(card)
            .getAllByText(t(`planningRoles.${role}`))
            .filter((element) => !element.closest("[hidden]"))
            .every((element) => roleEffort.contains(element))
        ).toBe(true);
      expect(within(roleEffort).queryByText(t("featureCard.metrics.peakTeam"))).toBeNull();
      for (const role of ROLES) {
        expect(roleEffort).toHaveTextContent(
          `${t(`planningRoles.${role}`)}${feature[`${role}_devs`] * feature[`${role}_weeks`]}`
        );
        const roleLabel = within(roleEffort).getByText(t(`planningRoles.${role}`));
        const effortLabel = within(card)
          .getAllByText(t("featureCard.metrics.effort"))
          .find((element) => element.tagName === "DIV");
        expect(roleLabel).toHaveClass(ROLE_COLORS[role].textClassName, "uppercase");
        expect(roleLabel.nextElementSibling?.className).toBe(
          effortLabel.nextElementSibling?.className
        );
      }
      await userEvent.click(toggle);
      expect(within(card).queryByRole("group", { name: t("featureCard.roleEffort") })).toBeNull();
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      for (const role of ROLES) {
        const area = within(card).getByRole("region", { name: t(`planningRoles.${role}`) });
        const values = within(area).getAllByRole("definition");
        expect(values[0]).toHaveTextContent(String(feature[`${role}_devs`]));
        expect(values[1]).toHaveTextContent(String(feature[`${role}_weeks`]));
        expect(values[2]?.textContent).toBe(
          `${feature[`${role}_devs`] * feature[`${role}_weeks`]}${t("common.units.personWeeksShort")}`
        );
        expect(
          within(area)
            .getAllByRole("term")
            .map((term) => term.textContent)
        ).toEqual([
          t("common.units.people"),
          t("common.units.weeks"),
          t("featureCard.metrics.effort"),
        ]);
      }
      const peak = within(card).getByText(t("featureCard.metrics.peakTeam")).parentElement!;
      const duration = within(card).getByText(t("featureCard.metrics.duration")).parentElement!;
      const effort = within(card).getAllByText(t("featureCard.metrics.effort"))[0]!.parentElement!;
      // Design, development and QA run one after another; development is the busiest phase.
      expect(peak).toHaveTextContent(`3${t("common.units.people")}`);
      expect(duration).toHaveTextContent(`5${t("common.units.weeks")}`);
      expect(effort).toHaveTextContent(`11${t("common.units.personWeeksShort")}`);
      expect(
        peak.compareDocumentPosition(
          screen.getByRole("region", { name: t("planningRoles.backend") })
        ) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );

  it("shows the main project label before the feature title only when assigned", () => {
    const { rerender } = render(
      <FeatureEstimateCard
        feature={feature}
        mainProjectName="Payments"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
        readOnly
      />
    );
    const title = screen.getByRole("heading", { level: 3 });
    expect(title.textContent).toBe(`Payments${feature.name}`);
    expect(title.firstElementChild).toHaveTextContent("Payments");
    rerender(
      <FeatureEstimateCard
        feature={feature}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
        readOnly
      />
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      new RegExp(`^${feature.name}$`)
    );
  });

  it("shows zero estimates for unused areas without hiding their labels", async () => {
    renderCard({ ...feature, ...EMPTY_FEATURE, name: feature.name }, true);
    await userEvent.click(screen.getByRole("button", { name: i18n.t("featureCard.showDetails") }));
    for (const role of ROLES) {
      const area = screen.getByRole("region", { name: i18n.t(`planningRoles.${role}`) });
      expect(
        within(area)
          .getAllByRole("definition")
          .map((item) => item.textContent)
      ).toEqual(["0", "0", `0${i18n.t("common.units.personWeeksShort")}`]);
    }
    expect(screen.getByText(i18n.t("featureCard.noEstimates"))).toBeVisible();
    expect(screen.queryByRole("button", { name: /Edit Checkout/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: i18n.t("featureCard.hideDetails") }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
