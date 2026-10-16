import React from "react";
import { PROJECTS } from "@jordiorriols/ui";

const Icon = PROJECTS.find((project) => project.id === "planner")!.icon;

export function AppIcon() {
  return <Icon className="cadence-icon" />;
}
