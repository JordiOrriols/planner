import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createInMemoryRepository } from "@/data/__tests__/inMemoryRepository";
import { createManagerStore, createPeerTokenStore } from "@/data/evaluationStore";
import type { EvaluationStore } from "@/data/evaluationStore";
import { useEvaluationEditor } from "../useEvaluationEditor";

const renderEditor = async (store: EvaluationStore) => {
  const hook = renderHook(() => useEvaluationEditor(store));
  await waitFor(() => expect(hook.result.current.loadState).toBe("ready"));
  return hook;
};

describe("useEvaluationEditor", () => {
  beforeEach(() => localStorage.clear());

  it("changes peer status without changing the manager draft", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Ada", role: "", templateId: null });
    const input = {
      status: "draft" as const,
      authorName: null,
      currentLevels: {},
      goalLevels: {},
      comments: {},
    };
    const manager = await repo.createEvaluation(member.id, "manager", input);
    const peer = await repo.createEvaluation(member.id, "peer", { ...input, authorName: "Peer" });
    const { result } = await renderEditor(createManagerStore(repo, member.id));
    await act(async () => result.current.changeVersionStatus(peer, "published"));
    expect(result.current.evaluations.find((item) => item.id === peer.id)?.status).toBe(
      "published"
    );
    expect(result.current.evaluations.find((item) => item.id === manager.id)?.status).toBe("draft");
    await act(async () =>
      result.current.changeVersionStatus({ ...peer, status: "published" }, "draft")
    );
    expect(result.current.evaluations.find((item) => item.id === peer.id)?.status).toBe("draft");
  });

  it.each([false, true])(
    "opens self blank after publishing, even with stale draft: %s",
    async (staleDraft) => {
      const repo = createInMemoryRepository();
      const member = await repo.createMember({ name: "Ada", role: "Dev", templateId: null });
      const input = {
        authorName: "Ada",
        currentLevels: { Technology: 4 },
        goalLevels: {},
        comments: { Technology: "old" },
      };
      if (staleDraft)
        await repo.createEvaluation(member.id, "self", { ...input, status: "draft" }, "2026-01-01");
      await repo.createEvaluation(
        member.id,
        "self",
        { ...input, status: "published" },
        "2026-02-01"
      );
      const create = vi.fn((value) => repo.createEvaluation(member.id, "self", value));
      const store: EvaluationStore = {
        ...createManagerStore(repo, member.id),
        kind: "self",
        editableProfile: false,
        showHistory: false,
        load: async () => ({
          profile: { name: "Ada", role: "Dev", templateId: null },
          evaluations: await repo.listEvaluations(member.id),
        }),
        create,
      };
      const { result } = await renderEditor(store);
      expect(result.current.form).toEqual({ currentLevels: {}, goalLevels: {}, comments: {} });
      expect(result.current.dirty).toBe(false);
      expect(result.current.editingId).toBeNull();
      expect(create).not.toHaveBeenCalled();
      act(() => result.current.handleCurrentChange("Technology", 2));
      await waitFor(() => expect(result.current.autosaveState).toBe("saved"));
      expect(
        (await repo.listEvaluations(member.id)).filter((item) => item.status === "draft")
      ).toHaveLength(1);
      expect(result.current.form.currentLevels).toEqual({ Technology: 2 });
    }
  );

  it("resumes the latest self draft", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Ada", role: "", templateId: null });
    const draft = await repo.createEvaluation(member.id, "self", {
      status: "draft",
      authorName: "Ada",
      currentLevels: { Technology: 3 },
      goalLevels: {},
      comments: {},
    });
    const store: EvaluationStore = {
      ...createManagerStore(repo, member.id),
      kind: "self",
      editableProfile: false,
      load: async () => ({
        profile: { name: "Ada", role: "", templateId: null },
        evaluations: [draft],
      }),
    };
    const { result } = await renderEditor(store);
    expect(result.current.editingId).toBe(draft.id);
    expect(result.current.form.currentLevels).toEqual({ Technology: 3 });
    expect(result.current.dirty).toBe(false);
  });

  it("creates one draft, updates it in place, and publishes the same version", async () => {
    const repo = createInMemoryRepository();
    const store = createManagerStore(repo, null);
    const { result } = await renderEditor(store);

    act(() => {
      result.current.setName("Ada");
      result.current.setTemplateId("D2");
      result.current.handleCurrentChange("Technology", 2);
    });
    expect(result.current.dirty).toBe(true);

    await waitFor(() => expect(result.current.autosaveState).toBe("saved"));
    const draftId = result.current.editingId;
    expect(result.current.canPublish).toBe(true);

    act(() => result.current.handleCurrentChange("Technology", 3));
    await waitFor(() => expect(result.current.form.currentLevels.Technology).toBe(3));
    await waitFor(() => expect(result.current.autosaveState).toBe("saved"));
    expect(result.current.editingId).toBe(draftId);
    expect(result.current.evaluations).toHaveLength(1);

    await act(async () => {
      await result.current.save("published");
    });

    const memberId = result.current.memberId!;
    expect((await repo.getMember(memberId))?.templateId).toBe("D2");
    const versions = await repo.listEvaluations(memberId);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: draftId,
      status: "published",
      currentLevels: { Technology: 3 },
    });
    expect(result.current.canPublish).toBe(false);
    expect(result.current.dirty).toBe(false);

    act(() => result.current.handleCurrentChange("Technology", 4));
    await waitFor(() => expect(result.current.autosaveState).toBe("saved"));
    const branchedVersions = await repo.listEvaluations(memberId);
    expect(branchedVersions).toHaveLength(2);
    expect(branchedVersions.find((version) => version.id === draftId)?.status).toBe("published");
    expect(result.current.evaluations.filter((version) => version.status === "draft")).toHaveLength(
      1
    );
  });

  it("creates a new draft only after published content changes", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Bo", role: "", templateId: null });
    const published = await repo.createEvaluation(member.id, "manager", {
      status: "published",
      authorName: null,
      currentLevels: { Technology: 2 },
      goalLevels: {},
      comments: {},
    });
    const { result } = await renderEditor(createManagerStore(repo, member.id));

    expect(result.current.canPublish).toBe(false);
    act(() => result.current.handleCurrentChange("Technology", 3));
    await waitFor(() => expect(result.current.autosaveState).toBe("saved"));

    const versions = await repo.listEvaluations(member.id);
    expect(versions).toHaveLength(2);
    expect(versions.find((evaluation) => evaluation.id === published.id)?.status).toBe("published");
    expect(result.current.editingId).not.toBe(published.id);
  });

  it("saves profile-only changes without creating a version", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Bo", role: "Dev", templateId: null });
    await repo.createEvaluation(member.id, "manager", {
      status: "published",
      authorName: null,
      currentLevels: { Technology: 2 },
      goalLevels: {},
      comments: {},
    });
    const { result } = await renderEditor(createManagerStore(repo, member.id));

    act(() => result.current.setRole("Staff Engineer"));
    expect(result.current.profileChanged).toBe(true);
    expect(result.current.contentChanged).toBe(false);
    await waitFor(() => expect(result.current.autosaveState).toBe("saved"));

    expect((await repo.getMember(member.id))?.role).toBe("Staff Engineer");
    expect(await repo.listEvaluations(member.id)).toHaveLength(1);
    expect(result.current.dirty).toBe(false);
  });

  it("loads a selected version into the form and deletes versions", async () => {
    const repo = createInMemoryRepository();
    const member = await repo.createMember({ name: "Bo", role: "", templateId: null });
    const base = { authorName: null, goalLevels: {}, comments: {} };
    const old = await repo.createEvaluation(
      member.id,
      "manager",
      { ...base, status: "published", currentLevels: { Technology: 1 } },
      "2026-01-01T00:00:00.000Z"
    );
    const draft = await repo.createEvaluation(
      member.id,
      "manager",
      { ...base, status: "draft", currentLevels: { Technology: 4 } },
      "2026-02-01T00:00:00.000Z"
    );
    const self = await repo.createEvaluation(member.id, "self", {
      ...base,
      status: "published",
      currentLevels: { Technology: 2 },
    });

    const { result } = await renderEditor(createManagerStore(repo, member.id));
    expect(result.current.form.currentLevels).toEqual({ Technology: 4 });
    expect(result.current.compareIds).toEqual([self.id]);

    act(() => result.current.selectVersion(old.id));
    expect(result.current.form.currentLevels).toEqual({ Technology: 1 });
    expect(result.current.editingId).toBe(old.id);

    act(() => result.current.selectVersion(self.id));
    expect(result.current.compareIds).toEqual([]);

    await act(async () => result.current.deleteVersion(old));
    expect(result.current.evaluations.map((e) => e.id)).not.toContain(old.id);
    expect(result.current.editingId).toBe(draft.id);
  });

  it("reports not found for unknown peer links", async () => {
    const store = createPeerTokenStore("not-a-token");
    const { result } = renderHook(() => useEvaluationEditor(store));
    await waitFor(() => expect(result.current.loadState).not.toBe("loading"));
    expect(["notFound", "error"]).toContain(result.current.loadState);
  });
});
