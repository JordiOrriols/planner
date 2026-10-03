import type {
  Evaluation,
  EvaluationInput,
  EvaluationKind,
  EvaluationStatus,
  MemberProfile,
  SharedTeamAccess,
  SmartGoal,
  SmartGoalInput,
  Team,
  TeamShare,
  TeamMember,
} from "@/types";

export type MemberPatch = Partial<MemberProfile> & { viewEnabled?: boolean };

export interface Repository {
  readonly kind: "remote";
  listTeams(): Promise<Team[]>;
  createTeam(name: string): Promise<Team>;
  updateTeam(id: string, name: string): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  listTeamShares(teamId: string): Promise<TeamShare[]>;
  shareTeamByEmail(teamId: string, email: string, access: SharedTeamAccess): Promise<void>;
  updateTeamShare(teamId: string, userId: string, access: SharedTeamAccess): Promise<void>;
  removeTeamShare(teamId: string, userId: string): Promise<void>;
  moveMember(memberId: string, teamId: string): Promise<TeamMember>;
  listGoals(memberId: string): Promise<SmartGoal[]>;
  createGoal(memberId: string, input: SmartGoalInput): Promise<SmartGoal>;
  updateGoal(id: string, input: SmartGoalInput): Promise<SmartGoal>;
  deleteGoal(id: string): Promise<void>;
  appendGoalComment(id: string, text: string): Promise<SmartGoal>;
  listMembers(teamId?: string): Promise<TeamMember[]>;
  getMember(id: string): Promise<TeamMember | null>;
  createMember(profile: MemberProfile, teamId?: string): Promise<TeamMember>;
  updateMember(id: string, patch: MemberPatch): Promise<TeamMember>;
  deleteMember(id: string): Promise<void>;
  /** All evaluations visible to the owner, optionally scoped to one member. */
  listEvaluations(memberId?: string): Promise<Evaluation[]>;
  createEvaluation(
    memberId: string,
    kind: EvaluationKind,
    input: EvaluationInput,
    createdAt?: string
  ): Promise<Evaluation>;
  updateEvaluationDraft(id: string, input: EvaluationInput): Promise<Evaluation>;
  setEvaluationStatus(id: string, status: EvaluationStatus): Promise<void>;
  deleteEvaluation(id: string): Promise<void>;
}
