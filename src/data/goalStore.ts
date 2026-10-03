import type { SmartGoal, SmartGoalInput } from "@/types";
import type { Repository } from "./repository";
import * as tokenApi from "./tokenApi";

/** Goal access scoped to one member, via the owner's repository or a personal link. */
export interface GoalStore {
  mode: "manager" | "member";
  canDelete(): Promise<boolean>;
  list(): Promise<SmartGoal[]>;
  create(input: SmartGoalInput): Promise<SmartGoal>;
  update(id: string, input: SmartGoalInput): Promise<SmartGoal>;
  remove(id: string): Promise<void>;
  appendComment(id: string, text: string): Promise<SmartGoal>;
}

export const createRepositoryGoalStore = (repo: Repository, memberId: string): GoalStore => ({
  mode: "manager",
  async canDelete() {
    const [member, teams] = await Promise.all([repo.getMember(memberId), repo.listTeams()]);
    return teams.find((team) => team.id === member?.teamId)?.access === "owner";
  },
  list: () => repo.listGoals(memberId),
  create: (input) => repo.createGoal(memberId, input),
  update: (id, input) => repo.updateGoal(id, input),
  appendComment: (id, text) => repo.appendGoalComment(id, text),
  async remove(id) {
    const [member, teams] = await Promise.all([repo.getMember(memberId), repo.listTeams()]);
    if (teams.find((team) => team.id === member?.teamId)?.access !== "owner") {
      throw new Error("Only the team owner can delete goals");
    }
    await repo.deleteGoal(id);
  },
});

export const createTokenGoalStore = (token: string): GoalStore => ({
  mode: "member",
  canDelete: async () => false,
  list: () => tokenApi.listTokenGoals(token),
  async create() {
    throw new Error("Personal links cannot create goals");
  },
  update: (id, input) => tokenApi.updateTokenGoalProgress(token, id, input.progress),
  appendComment: (id, text) => tokenApi.appendTokenGoalComment(token, id, text),
  async remove() {
    throw new Error("Personal links cannot delete goals");
  },
});
