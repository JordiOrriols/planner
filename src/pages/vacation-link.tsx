import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppMain, AppPage, AppSkeleton } from "@jordiorriols/ui";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";

const repository = supabase ? createPlannerRepository(supabase) : null;

export default function VacationLink() {
  const { t } = useTranslation();

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
      return repository.loadVacation(token);
    },
  });
  return (
    <AppPage>
      <AppMain className="max-w-4xl space-y-5">
        <h1 className="text-3xl font-bold">{t("vacationLink.title")}</h1>
        <p className="text-muted-foreground">{t("vacationLink.description")}</p>
        {query.isPending && <AppSkeleton label={t("vacationLink.loading")} fullPage={false} />}
        {query.error && <p role="alert">{query.error.message}</p>}
        {query.data && repository && (
          <section className="panel p-5 space-y-4">
            <h2 className="text-xl font-semibold">{query.data.member.name}</h2>
            <AvailabilityEditor
              key={token}
              member={query.data.member}
              members={query.data.members}
              availability={query.data.availability}
              month={month}
              onMonthChange={setMonth}
              canEdit
              save={async (start, end, working) => {
                await repository.saveVacation(token, start, end, working);
                await client.invalidateQueries({ queryKey });
              }}
            />
          </section>
        )}
      </AppMain>
    </AppPage>
  );
}
