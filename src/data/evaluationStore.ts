import type {
  Evaluation,
  EvaluationInput,
  EvaluationKind,
  EvaluationStatus,
  MemberProfile,
  TeamMember,
} from "@/types";
import { newId } from "./evaluations";
import type { Repository } from "./repository";
import * as tokenApi from "./tokenApi";

export type StoreSnapshot = {
  profile: MemberProfile;
  evaluations: Evaluation[];
  member?: TeamMember;
};

/** Scoped access to one person's evaluations, regardless of where they are stored. */
export interface EvaluationStore {
  /** Kind of the versions this store creates. */
  kind: EvaluationKind;
  editableProfile: boolean;
  showHistory: boolean;
  memberId(): string | null;
  load(): Promise<StoreSnapshot | null>;
  saveProfile(profile: MemberProfile): Promise<void>;
  create(input: EvaluationInput): Promise<Evaluation>;
  updateDraft?(id: string, input: EvaluationInput): Promise<Evaluation>;
  setStatus(id: string, status: EvaluationStatus): Promise<void>;
  remove(id: string): Promise<void>;
  canChangeStatus(evaluation: Evaluation): boolean;
  canDelete(evaluation: Evaluation): boolean;
}

export function createManagerStore(
  repo: Repository,
  initialMemberId: string | null,
  initialTeamId?: string
) {
  let memberId = initialMemberId;
  let owner = false;
  let canEdit = false;
  const store: EvaluationStore = {
    kind: "manager",
    editableProfile: true,
    showHistory: true,
    memberId: () => memberId,
    async load() {
      if (!memberId) return { profile: { name: "", role: "", templateId: null }, evaluations: [] };
      const member = await repo.getMember(memberId);
      if (!member) return null;
      const [evaluations, teams] = await Promise.all([
        repo.listEvaluations(memberId),
        repo.listTeams(),
      ]);
      owner = teams.find((team) => team.id === member.teamId)?.access === "owner";
      canEdit = teams.some((team) => team.id === member.teamId && team.access !== "viewer");
      return {
        profile: { name: member.name, role: member.role, templateId: member.templateId },
        evaluations,
        member,
      };
    },
    async saveProfile(profile) {
      if (memberId) {
        await repo.updateMember(memberId, profile);
      } else {
        memberId = (
          await (initialTeamId
            ? repo.createMember(profile, initialTeamId)
            : repo.createMember(profile))
        ).id;
        const [member, teams] = await Promise.all([repo.getMember(memberId), repo.listTeams()]);
        owner = teams.find((team) => team.id === member?.teamId)?.access === "owner";
        canEdit = teams.some((team) => team.id === member?.teamId && team.access !== "viewer");
      }
    },
    async create(input) {
      if (!memberId) throw new Error("Save the member first");
      return repo.createEvaluation(memberId, "manager", input);
    },
    updateDraft: (id, input) => repo.updateEvaluationDraft(id, input),
    setStatus: (id, status) => repo.setEvaluationStatus(id, status),
    async remove(id) {
      if (!owner) throw new Error("Only the team owner can delete evaluations");
      await repo.deleteEvaluation(id);
    },
    // Self versions belong to the evaluated person; the owner can only hide them by deleting.
    canChangeStatus: (evaluation) => canEdit && evaluation.kind !== "self",
    canDelete: (evaluation) =>
      owner && (evaluation.kind !== "self" || evaluation.status === "published"),
  };
  return store;
}

export function createSelfTokenStore(token: string): EvaluationStore {
  return {
    kind: "self",
    editableProfile: false,
    showHistory: false,
    memberId: () => null,
    async load() {
      const info = await tokenApi.resolveToken(token);
      if (!info || info.linkKind !== "self") return null;
      return {
        profile: { name: info.name, role: info.role, templateId: info.templateId },
        evaluations: await tokenApi.listSelfEvaluations(token),
      };
    },
    async saveProfile() {},
    create: (input) => tokenApi.saveSelfEvaluation(token, input),
    updateDraft: (id, input) => tokenApi.updateSelfEvaluationDraft(token, id, input),
    setStatus: (id, status) => tokenApi.setSelfEvaluationStatus(token, id, status),
    async remove() {
      throw new Error("Personal links cannot delete evaluations");
    },
    canChangeStatus: () => true,
    canDelete: () => false,
  };
}

export function createPeerTokenStore(token: string): EvaluationStore {
  return {
    kind: "peer",
    editableProfile: false,
    showHistory: false,
    memberId: () => null,
    async load() {
      const info = await tokenApi.resolveToken(token);
      if (!info || info.linkKind !== "peer") return null;
      return {
        profile: { name: info.name, role: info.role, templateId: info.templateId },
        evaluations: [],
      };
    },
    async saveProfile() {},
    async create(input) {
      await tokenApi.submitPeerEvaluation(token, input);
      return {
        ...input,
        id: newId(),
        memberId: "",
        kind: "peer",
        createdAt: new Date().toISOString(),
      };
    },
    async setStatus() {},
    async remove() {},
    canChangeStatus: () => false,
    canDelete: () => false,
  };
}
