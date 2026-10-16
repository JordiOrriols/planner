import React, { type ReactNode } from "react";

export function PlanDateCard({
  label,
  value,
  action,
  children,
}: {
  label: string;
  value: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="panel" aria-label={label}>
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        <h2 className="text-xs font-normal text-muted-foreground">{label}</h2>
        {action}
      </div>
      {children ?? <p className="font-semibold">{value}</p>}
    </section>
  );
}
