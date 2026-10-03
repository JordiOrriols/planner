import { VERTICALS } from "@/components/atoms/levelSelector";
import type { Evaluation, EvaluationKind, LevelMap, Member, TeamMember } from "@/types";

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const byNewest = (a: Evaluation, b: Evaluation) => b.createdAt.localeCompare(a.createdAt);

export function latestOf(
  evaluations: Evaluation[],
  kind: EvaluationKind,
  publishedOnly = false
): Evaluation | undefined {
  return [...evaluations]
    .filter((e) => e.kind === kind && (!publishedOnly || e.status === "published"))
    .sort(byNewest)[0];
}

export function computeAverage(levels: LevelMap): number {
  if (Object.keys(levels).length === 0) return 0;
  const total = Object.values(levels).reduce((sum, value) => sum + value, 0);
  return total / VERTICALS.length;
}

export function toMemberSummary(member: TeamMember, evaluations: Evaluation[]): Member {
  const own = evaluations.filter((e) => e.memberId === member.id);
  const manager = latestOf(own, "manager");
  const self = latestOf(own, "self", true);
  return {
    id: member.id,
    teamId: member.teamId,
    name: member.name,
    role: member.role,
    templateId: member.templateId,
    currentLevels: manager?.currentLevels ?? {},
    goalLevels: manager?.goalLevels ?? {},
    comments: manager?.comments ?? {},
    selfAssessmentLevels: self?.currentLevels ?? {},
  };
}

const monthKey = (iso: string) => iso.slice(0, 7);

/** Month + year, adding the day only when the same author has several versions that month. */
export function versionLabel(evaluation: Evaluation, all: Evaluation[], locale: string): string {
  const date = new Date(evaluation.createdAt);
  const clash = all.some(
    (other) =>
      other.id !== evaluation.id &&
      other.kind === evaluation.kind &&
      (other.authorName ?? "") === (evaluation.authorName ?? "") &&
      monthKey(other.createdAt) === monthKey(evaluation.createdAt)
  );
  const options: Intl.DateTimeFormatOptions = clash
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "long", year: "numeric" };
  return new Intl.DateTimeFormat(locale, options).format(date);
}
