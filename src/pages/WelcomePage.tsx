import React, { useState } from "react";
import { Button } from "@jordiorriols/ui";
import { CalendarDays, Calculator, GanttChartSquare } from "@jordiorriols/ui/icons";
import { LoginDialog } from "@/components/molecules/LoginDialog";
import { useData } from "@/data/DataProvider";

export function WelcomePage() {
  const { authEnabled, authError } = useData();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [open, setOpen] = useState(false);
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-6">
      <div className="max-w-xl space-y-8 py-16">
        <div className="flex gap-3 items-center text-indigo-600">
          <GanttChartSquare size={32} />
          <span className="font-semibold text-xl">Cadence / Planner</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Make room for the work ahead.</h1>
        <p className="text-lg text-slate-600">
          Estimate microprojects, plan around real squad capacity, and keep everyone&apos;s time off
          in view.
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
          <div>
            <Calculator className="mb-2" />
            Role-based estimates
          </div>
          <div>
            <GanttChartSquare className="mb-2" />A realistic backlog
          </div>
          <div>
            <CalendarDays className="mb-2" />
            Barcelona calendar
          </div>
        </div>
        {authError && <p role="alert">{authError}</p>}
        {!authEnabled && (
          <p role="alert">
            Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use your Ladders
            account. Planner does not save data locally.
          </p>
        )}
        <div className="flex gap-3">
          <Button
            disabled={!authEnabled}
            onClick={() => {
              setMode("signIn");
              setOpen(true);
            }}
          >
            Sign in
          </Button>
          <Button
            disabled={!authEnabled}
            variant="outline"
            onClick={() => {
              setMode("signUp");
              setOpen(true);
            }}
          >
            Create account
          </Button>
        </div>
        <LoginDialog isOpen={open} initialMode={mode} onClose={() => setOpen(false)} />
      </div>
    </main>
  );
}
