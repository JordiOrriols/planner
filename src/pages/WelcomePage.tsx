import React, { useState } from "react";
import { WelcomeScreen } from "@jordiorriols/ui";
import { useTranslation } from "react-i18next";
import { CalendarDays, Calculator, GanttChartSquare } from "@jordiorriols/ui/icons";
import { LoginDialog } from "@/components/molecules/LoginDialog";
import { useData } from "@/data/DataProvider";

export function WelcomePage() {
  const { t } = useTranslation();
  const { authEnabled, authError } = useData();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [open, setOpen] = useState(false);
  return (
    <WelcomeScreen
      brand={t("planner.brand")}
      icon={<GanttChartSquare />}
      title={t("planner.welcome.title")}
      description={t("planner.welcome.description")}
      features={[
        { icon: <Calculator />, label: t("planner.welcome.estimates") },
        { icon: <GanttChartSquare />, label: t("planner.welcome.backlog") },
        { icon: <CalendarDays />, label: t("planner.welcome.calendar") },
      ]}
      signInLabel={t("auth.signIn")}
      signUpLabel={t("auth.signUp")}
      disabled={!authEnabled}
      onSignIn={() => {
        setMode("signIn");
        setOpen(true);
      }}
      onSignUp={() => {
        setMode("signUp");
        setOpen(true);
      }}
      notice={
        <>
          {authError && <p role="alert">{authError}</p>}
          {!authEnabled && <p role="alert">{t("planner.welcome.authUnavailable")}</p>}
        </>
      }
    >
      <LoginDialog isOpen={open} initialMode={mode} onClose={() => setOpen(false)} />
    </WelcomeScreen>
  );
}
