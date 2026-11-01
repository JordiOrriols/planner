import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PublicAppShell, AppSkeleton } from "@jordiorriols/ui";
import { VacationEditor } from "@/components/organisms/vacation-editor";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";

const repository = supabase ? createPlannerRepository(supabase) : null;

export default function VacationLink() {
  const { t, i18n } = useTranslation();

  const { token = "" } = useParams();
  const [month, setMonth] = useState(new Date());
  const client = useQueryClient();
  const queryKey = ["planner-vacation-link", token];
  const query = useQuery({
    queryKey,
    retry: false,
    queryFn: () => {
      if (!z.string().uuid().safeParse(token).success)
        throw new Error(t("vacationLink.errors.invalidLink"));
      if (!repository) throw new Error(t("vacationLink.errors.notConfigured"));
      return repository.loadVacationLink(token);
    },
  });
  return (
    <PublicAppShell
      projectId="planner"
      mainClassName="max-w-4xl space-y-5"
      footer={{ text: t("app.footer") }}
      header={{
        title: t("vacationLink.title"),
        subtitle: t("vacationLink.description"),
        language: {
          value: i18n.language,
          label: t("header.language"),
          onValueChange: (language) => void i18n.changeLanguage(language),
        },
      }}
    >
      {query.isPending && <AppSkeleton label={t("vacationLink.loading")} fullPage={false} />}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && repository && (
        <section className="panel p-5 space-y-4">
          <h2 className="text-xl font-semibold">{query.data.member.name}</h2>
          <VacationEditor
            key={token}
            member={query.data.member}
            members={query.data.members}
            vacations={query.data.vacations}
            month={month}
            onMonthChange={setMonth}
            canEdit
            save={async (start, end, working) => {
              await repository.saveVacationLink(token, start, end, working);
              await client.invalidateQueries({ queryKey });
            }}
          />
        </section>
      )}
    </PublicAppShell>
  );
}
