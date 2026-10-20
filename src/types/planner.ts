export const ROLES = ["backend", "frontend", "design", "qa"] as const;
export type Role = (typeof ROLES)[number];
export const FEATURE_STATUSES = ["pending", "in_progress", "done", "paused"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type Estimates = Record<`${Role}_devs` | `${Role}_weeks`, number>;
export type FeatureInput = Estimates & {
  name: string;
  description: string;
  project_id: string | null;
  status: FeatureStatus;
};
export interface Project {
  id: string;
  workspace_id: string;
  name: string;
}
export type Feature = Omit<FeatureInput, "project_id"> & {
  id: string;
  project_id: string;
  in_backlog: boolean;
  priority: number;
};
export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan_start_date: string;
  sprint_start_date: string;
  sprint_history: SprintResult[];
}
export interface SprintResult {
  start_date: string;
  story_points: number;
}
export interface PlannerMember {
  id: string;
  team_id: string;
  name: string;
  role: Role | null;
  can_edit: boolean;
  vacation_token: string | null;
}
export interface LinkedTeam {
  id: string;
  name: string;
}
export type WorkspaceAccess = "viewer" | "editor";
export interface Vacation {
  member_id: string;
  date: string;
  is_working: boolean;
}
export const EMPTY_FEATURE: FeatureInput = {
  name: "",
  description: "",
  project_id: null,
  status: "pending",
  backend_devs: 0,
  backend_weeks: 0,
  frontend_devs: 0,
  frontend_weeks: 0,
  design_devs: 0,
  design_weeks: 0,
  qa_devs: 0,
  qa_weeks: 0,
};
