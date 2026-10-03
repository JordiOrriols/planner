export const ROLES = ["backend", "frontend", "design", "qa"] as const;
export type Role = (typeof ROLES)[number];
export type Estimates = Record<`${Role}_devs` | `${Role}_weeks`, number>;
export type ProjectInput = Estimates & { name: string; description: string };
export type Project = ProjectInput & {
  id: string;
  workspace_id: string;
  in_backlog: boolean;
  priority: number;
};
export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}
export interface PlannerMember {
  id: string;
  team_id: string;
  name: string;
  role: Role | null;
  can_edit: boolean;
  vacation_token: string | null;
}
export interface LaddersTeam {
  id: string;
  name: string;
  access_level: "owner" | "editor" | "viewer";
}
export type LinkedTeam = Pick<LaddersTeam, "id" | "name">;
export interface Availability {
  member_id: string;
  date: string;
  is_working: boolean;
}
export interface Invitation {
  member_id: string;
  workspace_name: string;
}
export const EMPTY_PROJECT: ProjectInput = {
  name: "",
  description: "",
  backend_devs: 0,
  backend_weeks: 0,
  frontend_devs: 0,
  frontend_weeks: 0,
  design_devs: 0,
  design_weeks: 0,
  qa_devs: 0,
  qa_weeks: 0,
};
