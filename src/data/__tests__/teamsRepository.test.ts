import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "./inMemoryRepository";
import type { GoalComment } from "@/types";

describe("team repository contract", () => {
  it("creates a default team and moves members between teams", async () => {
    const repo = createInMemoryRepository();
    const [defaultTeam] = await repo.listTeams();
    const platform = await repo.createTeam("Platform");
    const member = await repo.createMember({ name: "Ada", role: "Dev", templateId: null });

    expect(defaultTeam?.isDefault).toBe(true);
    expect(member.teamId).toBe(defaultTeam?.id);
    expect((await repo.moveMember(member.id, platform.id)).teamId).toBe(platform.id);
  });

  it("manages team shares and blocks populated team deletion", async () => {
    const repo = createInMemoryRepository();
    const platform = await repo.createTeam("Platform");
    await repo.shareTeamByEmail(platform.id, "ada@example.com", "editor");
    const [share] = await repo.listTeamShares(platform.id);
    expect(share).toMatchObject({ email: "ada@example.com", access: "editor" });

    await repo.updateTeamShare(platform.id, share!.userId, "viewer");
    expect((await repo.listTeamShares(platform.id))[0]?.access).toBe("viewer");

    await repo.createMember({ name: "Ada", role: "Dev", templateId: null }, platform.id);
    await expect(repo.deleteTeam(platform.id)).rejects.toThrow("Team is not empty");
  });

  it("keeps SMART goals scoped to their member", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Ada", role: "Dev", templateId: null });
    const goal = await repo.createGoal(member.id, {
      title: "Improve onboarding",
      description: "Document the first-week path.",
      dueDate: null,
      progress: 0,
    });

    expect((await repo.listGoals(member.id))[0]).toMatchObject({
      id: goal.id,
      title: "Improve onboarding",
    });
    await repo.appendGoalComment(goal.id, "First comment");
    await repo.appendGoalComment(goal.id, "Second comment");
    await repo.updateGoal(goal.id, {
      title: goal.title,
      description: goal.description,
      dueDate: goal.dueDate,
      progress: 50,
    });
    expect(
      (await repo.listGoals(member.id))[0]?.comments.map((comment: GoalComment) => comment.text)
    ).toEqual(["First comment", "Second comment"]);
    expect((await repo.listGoals(member.id))[0]?.progress).toBe(50);
    await repo.deleteGoal(goal.id);
    expect(await repo.listGoals(member.id)).toHaveLength(0);
  });
});
