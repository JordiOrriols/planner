import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Calculator,
  GanttChartSquare,
  CalendarDays,
  ChevronDown,
  Check,
  Plus,
} from "@jordiorriols/ui/icons";
import { DropdownMenu } from "@jordiorriols/ui/radix";
import { cn } from "@/lib/utils";
import { AppHeader, Button, LanguageSelector, buttonVariants } from "@jordiorriols/ui";
import { useTranslation } from "react-i18next";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { ShareWorkspaceDialog } from "@/components/molecules/ShareWorkspaceDialog";

const NAV = [
  { to: "/", key: "estimation", icon: Calculator, end: true },
  { to: "/backlog", key: "backlog", icon: GanttChartSquare, end: false },
  { to: "/vacations", key: "vacations", icon: CalendarDays, end: false },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useData();
  const { workspace, workspaces, selectWorkspace, isOwner, canEdit, createWorkspace } =
    useWorkspace();
  const [sharing, setSharing] = useState(false);
  const action = useAsyncAction();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={t("planner.name")}
        subtitle={t("planner.subtitle")}
        icon={<GanttChartSquare className="cadence-icon" />}
        actions={
          <LanguageSelector
            value={i18n.language}
            label={t("header.language")}
            className="inline-flex"
            onValueChange={(language) =>
              void action.run(async () => {
                await i18n.changeLanguage(language);
              })
            }
          />
        }
        accountAction={{
          type: "signOut",
          label: t("auth.signOut"),
          title: user?.email ?? "",
          disabled: action.busy,
          onClick: () => void action.run(signOut),
        }}
        navigation={
          <nav
            aria-label={t("planner.pages")}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {NAV.map(({ to, key, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={t(`planner.tabs.${key}`)}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(`planner.tabs.${key}`)}</span>
                </NavLink>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 py-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  aria-label={t("planner.workspace")}
                  title={workspace.name}
                >
                  <span className="max-w-32 truncate sm:max-w-48">{workspace.name}</span>
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    {t(isOwner ? "planner.owner" : canEdit ? "teams.editor" : "teams.viewer")}
                  </span>
                  <ChevronDown className="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-50 min-w-56 max-h-80 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
                  >
                    <DropdownMenu.RadioGroup
                      value={workspace.id}
                      onValueChange={(id) => {
                        setSharing(false);
                        selectWorkspace(id);
                      }}
                    >
                      {workspaces.map((item) => (
                        <DropdownMenu.RadioItem
                          key={item.id}
                          value={item.id}
                          className="flex items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                        >
                          <span className="size-4">
                            <DropdownMenu.ItemIndicator>
                              <Check className="size-4" />
                            </DropdownMenu.ItemIndicator>
                          </span>
                          <span className="max-w-64 truncate">{item.name}</span>
                        </DropdownMenu.RadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item
                      className="flex items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                      onSelect={() => {
                        setSharing(false);
                        createWorkspace();
                      }}
                    >
                      <Plus className="size-4" />
                      {t("planner.newWorkspace")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
                  {t("teams.share")}
                </Button>
              )}
            </div>
          </nav>
        }
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {action.error && (
          <p role="alert" className="px-6 text-destructive">
            {action.error}
          </p>
        )}
        <Outlet />
        {isOwner && sharing && <ShareWorkspaceDialog onClose={() => setSharing(false)} />}
      </main>
    </div>
  );
}
