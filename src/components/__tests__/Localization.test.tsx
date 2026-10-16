import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { APP_LANGUAGES } from "@jordiorriols/ui";
import i18n from "@/i18n";
import ProjectForm from "@/components/organisms/project-form";
import VacationCalendar from "@/components/organisms/vacation-calendar";
import { holidayName } from "@/lib/barcelonaHolidays";
import { fmtDate, ROLE_LABELS, validateProject } from "@/lib/planning";
import { EMPTY_PROJECT } from "@/types/planner";

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("Planner localization", () => {
  it.each(APP_LANGUAGES.map(({ code }) => code))(
    "renders feature forms, calendar and errors from the %s catalog",
    async (language) => {
      await i18n.changeLanguage(language);
      const t = i18n.getFixedT(language);
      const form = render(<ProjectForm open initial={null} onClose={vi.fn()} onSave={vi.fn()} />);
      expect(
        screen.getByRole("heading", { name: t("featureForm.createTitle") })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("spinbutton", {
          name: t("featureForm.fields.rolePeople", { role: t("planningRoles.design") }),
        })
      ).toBeInTheDocument();
      form.unmount();
      render(
        <VacationCalendar
          month={new Date(2026, 9, 1)}
          onMonthChange={vi.fn()}
          teamMembers={[]}
          availability={[]}
          selectedMember=""
          onSelectRange={vi.fn()}
          disabled={false}
        />
      );
      expect(
        screen.getByRole("button", { name: t("vacationCalendar.navigation.previous") })
      ).toBeInTheDocument();
      const month = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(
        new Date(2026, 9, 1)
      );
      expect(screen.getByRole("heading", { name: month })).toBeInTheDocument();
      expect(holidayName("2026-10-12")).toBe(t("holidays.hispanicDay"));
      expect(ROLE_LABELS.design).toBe(t("planningRoles.design"));
      expect(() => validateProject(EMPTY_PROJECT)).toThrow(
        t("planning.validation.featureNameRequired")
      );
      expect(fmtDate(new Date(2026, 9, 12))).toBe(
        new Intl.DateTimeFormat(language, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(2026, 9, 12))
      );
      expect(document.documentElement.lang).toBe(language);
      if (language !== "en")
        expect(t("featureForm.createTitle")).not.toBe(
          i18n.getFixedT("en")("featureForm.createTitle")
        );
    }
  );

  it("updates mounted UI and holiday names when switching languages without resetting the form", async () => {
    render(
      <ProjectForm
        open
        initial={{ ...EMPTY_PROJECT, name: "User feature" }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    const oldHoliday = holidayName("2026-10-12");
    await act(async () => {
      await i18n.changeLanguage("es");
    });
    expect(
      screen.getByRole("heading", { name: i18n.t("featureForm.editTitle") })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: i18n.t("featureForm.fields.name") })).toHaveValue(
      "User feature"
    );
    expect(holidayName("2026-10-12")).not.toBe(oldHoliday);
  });
});
