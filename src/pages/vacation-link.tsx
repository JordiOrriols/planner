import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AvailabilityEditor } from "@/components/organisms/availability-editor";
import { createPlannerRepository } from "@/data/plannerRepository";
import { supabase } from "@/data/supabaseClient";

const repository = supabase ? createPlannerRepository(supabase) : null;

export default function VacationLink() {
  const { token = "" } = useParams();
  const [month, setMonth] = useState(new Date());
  const client = useQueryClient();
  const queryKey = ["planner-vacation-link", token];
  const query = useQuery({
    queryKey,
    retry: false,
    queryFn: () => {
      if (!z.string().uuid().safeParse(token).success) throw new Error("Invalid vacation link");
      if (!repository) throw new Error("Supabase is not configured. Contact the team owner.");
      return repository.loadVacation(token);
    },
  });
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-3xl font-bold">Your planned vacations</h1>
      <p className="text-muted-foreground">
        This personal link lets you update only your availability. Changes apply to every linked
        planning workspace. Keep this link private.
      </p>
      {query.isPending && <p role="status">Loading vacation calendar...</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && repository && (
        <section className="panel p-5 space-y-4">
          <h2 className="text-xl font-semibold">{query.data.member.name}</h2>
          <AvailabilityEditor
            key={token}
            member={query.data.member}
            members={[query.data.member]}
            availability={query.data.availability}
            month={month}
            onMonthChange={setMonth}
            canEdit
            save={async (start, end, working) => {
              await repository.saveVacation(token, start, end, working);
              await client.invalidateQueries({ queryKey });
            }}
            clear={async (date) => {
              await repository.clearVacation(token, date);
              await client.invalidateQueries({ queryKey });
            }}
          />
        </section>
      )}
    </main>
  );
}
