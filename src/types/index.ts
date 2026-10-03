export type LevelMap = Record<string, number>;
export type CommentMap = Record<string, string>;

export type EvaluationKind = "manager" | "self" | "peer";
export type EvaluationStatus = "draft" | "published";
export type TeamAccess = "owner" | "editor" | "viewer";
export type SharedTeamAccess = Exclude<TeamAccess, "owner">;

export interface Team {
  id: string;
  ownerId: string;
  name: string;
  isDefault: boolean;
  access: TeamAccess;
  createdAt: string;
  updatedAt: string;
}

export interface TeamShare {
  teamId: string;
  userId: string;
  email: string;
  access: SharedTeamAccess;
  sharedAt: string;
}

export interface SmartGoal {
  id: string;
  memberId: string;
  title: string;
  description: string;
  dueDate: string | null;
  progress: number;
  comments: GoalComment[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalComment {
  id: string;
  text: string;
  createdAt: string;
  authorKind: "manager" | "member" | "legacy";
}

export type SmartGoalInput = Omit<
  SmartGoal,
  "id" | "memberId" | "createdAt" | "updatedAt" | "comments"
>;

/** Summary used by team views; levels come from the latest manager and self versions. */
export interface Member {
  id: string;
  teamId: string;
  name: string;
  role?: string;
  currentLevels: LevelMap;
  goalLevels: LevelMap;
  comments?: CommentMap;
  selfAssessmentLevels?: LevelMap;
  selfAssessmentComments?: CommentMap;
  templateId?: string | null;
}

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  role: string;
  templateId: string | null;
  selfToken: string | null;
  peerToken: string | null;
  viewToken: string | null;
  viewEnabled: boolean;
  createdAt: string;
}

export interface EvaluationInput {
  status: EvaluationStatus;
  authorName: string | null;
  currentLevels: LevelMap;
  goalLevels: LevelMap;
  comments: CommentMap;
}

export interface Evaluation extends EvaluationInput {
  id: string;
  memberId: string;
  kind: EvaluationKind;
  createdAt: string;
}

export type MemberProfile = {
  name: string;
  role: string;
  templateId: string | null;
};
