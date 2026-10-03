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
  TeamMember,
  TeamShare,
} from "@/types";
import type { MemberPatch, Repository } from "../repository";

let sequence = 0;
const id = (prefix: string) => `${prefix}-${++sequence}`;

export function createInMemoryRepository(): Repository {
  const defaultTeam: Team = {
    id: id("team"),
    ownerId: "owner",
    name: "Default Team",
    isDefault: true,
    access: "owner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let teams: Team[] = [defaultTeam];
  let shares: TeamShare[] = [];
  let members: TeamMember[] = [];
  let evaluations: Evaluation[] = [];
  let goals: SmartGoal[] = [];

  return {
    kind: "remote",
    async listTeams() {
      return teams;
    },
    async createTeam(name: string) {
      const team: Team = {
        ...defaultTeam,
        id: id("team"),
        name,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      teams = [...teams, team];
      return team;
    },
    async updateTeam(teamId: string, name: string) {
      const current = teams.find((team) => team.id === teamId);
      if (!current) throw new Error("Team not found");
      const updated = { ...current, name, updatedAt: new Date().toISOString() };
      teams = teams.map((team) => (team.id === teamId ? updated : team));
      return updated;
    },
    async deleteTeam(teamId: string) {
      const team = teams.find((item) => item.id === teamId);
      if (!team) throw new Error("Team not found");
      if (team.isDefault) throw new Error("Default team cannot be deleted");
      if (members.some((member) => member.teamId === teamId)) throw new Error("Team is not empty");
      teams = teams.filter((item) => item.id !== teamId);
    },
    async listTeamShares(teamId: string) {
      return shares.filter((share) => share.teamId === teamId);
    },
    async shareTeamByEmail(teamId: string, email: string, access: SharedTeamAccess) {
      const existing = shares.find((share) => share.teamId === teamId && share.email === email);
      const share: TeamShare = {
        teamId,
        userId: existing?.userId ?? id("user"),
        email,
        access,
        sharedAt: existing?.sharedAt ?? new Date().toISOString(),
      };
      shares = [
        ...shares.filter((item) => !(item.teamId === teamId && item.email === email)),
        share,
      ];
    },
    async updateTeamShare(teamId: string, userId: string, access: SharedTeamAccess) {
      shares = shares.map((share) =>
        share.teamId === teamId && share.userId === userId ? { ...share, access } : share
      );
    },
    async removeTeamShare(teamId: string, userId: string) {
      shares = shares.filter((share) => share.teamId !== teamId || share.userId !== userId);
    },
    async moveMember(memberId: string, teamId: string) {
      const current = members.find((member) => member.id === memberId);
      if (!current) throw new Error("Member not found");
      if (!teams.some((team) => team.id === teamId)) throw new Error("Team not found");
      const updated = { ...current, teamId };
      members = members.map((member) => (member.id === memberId ? updated : member));
      return updated;
    },
    async listGoals(memberId: string) {
      return goals.filter((goal) => goal.memberId === memberId);
    },
    async createGoal(memberId: string, input: SmartGoalInput) {
      const now = new Date().toISOString();
      const goal: SmartGoal = {
        id: id("goal"),
        memberId,
        ...input,
        comments: [],
        createdAt: now,
        updatedAt: now,
      };
      goals = [...goals, goal];
      return goal;
    },
    async updateGoal(goalId: string, input: SmartGoalInput) {
      const current = goals.find((goal) => goal.id === goalId);
      if (!current) throw new Error("Goal not found");
      const updated = {
        ...current,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        progress: input.progress,
        updatedAt: new Date().toISOString(),
      };
      goals = goals.map((goal) => (goal.id === goalId ? updated : goal));
      return updated;
    },
    async deleteGoal(goalId: string) {
      goals = goals.filter((goal) => goal.id !== goalId);
    },
    async appendGoalComment(goalId: string, text: string) {
      const current = goals.find((goal) => goal.id === goalId);
      if (!current || !text.trim()) throw new Error("Invalid comment");
      const updated: SmartGoal = {
        ...current,
        comments: [
          ...current.comments,
          {
            id: id("comment"),
            text: text.trim(),
            createdAt: new Date().toISOString(),
            authorKind: "manager",
          },
        ],
      };
      goals = goals.map((goal) => (goal.id === goalId ? updated : goal));
      return updated;
    },
    async listMembers() {
      return members;
    },
    async getMember(memberId: string) {
      return members.find((member) => member.id === memberId) ?? null;
    },
    async createMember(profile: MemberProfile, teamId = defaultTeam.id) {
      const member: TeamMember = {
        id: id("member"),
        teamId,
        ...profile,
        selfToken: id("self"),
        peerToken: id("peer"),
        viewToken: id("view"),
        viewEnabled: false,
        createdAt: new Date().toISOString(),
      };
      members = [...members, member];
      return member;
    },
    async updateMember(memberId: string, patch: MemberPatch) {
      const current = members.find((member) => member.id === memberId);
      if (!current) throw new Error("Member not found");
      const updated = { ...current, ...patch };
      members = members.map((member) => (member.id === memberId ? updated : member));
      return updated;
    },
    async deleteMember(memberId: string) {
      members = members.filter((member) => member.id !== memberId);
      evaluations = evaluations.filter((evaluation) => evaluation.memberId !== memberId);
      goals = goals.filter((goal) => goal.memberId !== memberId);
    },
    async listEvaluations(memberId?: string) {
      return memberId
        ? evaluations.filter((evaluation) => evaluation.memberId === memberId)
        : evaluations;
    },
    async createEvaluation(
      memberId: string,
      kind: EvaluationKind,
      input: EvaluationInput,
      createdAt?: string
    ) {
      const evaluation: Evaluation = {
        ...input,
        id: id("evaluation"),
        memberId,
        kind,
        createdAt: createdAt ?? new Date().toISOString(),
      };
      evaluations = [...evaluations, evaluation];
      return evaluation;
    },
    async updateEvaluationDraft(evaluationId: string, input: EvaluationInput) {
      const current = evaluations.find((evaluation) => evaluation.id === evaluationId);
      if (!current) throw new Error("Evaluation not found");
      if (current.status !== "draft") throw new Error("Only drafts can be updated");
      const updated = { ...current, ...input, authorName: current.authorName };
      evaluations = evaluations.map((evaluation) =>
        evaluation.id === evaluationId ? updated : evaluation
      );
      return updated;
    },
    async setEvaluationStatus(evaluationId: string, status: EvaluationStatus) {
      evaluations = evaluations.map((evaluation) =>
        evaluation.id === evaluationId ? { ...evaluation, status } : evaluation
      );
    },
    async deleteEvaluation(evaluationId: string) {
      evaluations = evaluations.filter((evaluation) => evaluation.id !== evaluationId);
    },
  };
}
