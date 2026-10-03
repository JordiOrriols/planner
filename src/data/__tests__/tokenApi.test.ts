import { describe, it, expect, vi, beforeEach } from "vitest";
import * as tokenApi from "../tokenApi";
import { createPeerTokenStore, createSelfTokenStore } from "../evaluationStore";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { rpc } }));

const TOKEN = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "e1",
  member_id: "m1",
  kind: "self",
  status: "draft",
  author_name: "Ada",
  current_levels: { Technology: 2 },
  goal_levels: {},
  comments: {},
  created_at: "2026-01-02",
};
const input = {
  status: "published" as const,
  authorName: "Bob",
  currentLevels: { Technology: 3 },
  goalLevels: {},
  comments: {},
};

describe("tokenApi", () => {
  beforeEach(() => rpc.mockReset());

  it("manages SMART goals through token RPCs", async () => {
    const goalRow = {
      id: "g1",
      member_id: "m1",
      title: "Mentor",
      description: "",
      due_date: null,
      progress: 20,
      comments: [],
      created_at: "2026-01-02",
      updated_at: "2026-01-02",
    };
    rpc.mockResolvedValue({ data: goalRow, error: null });
    expect(await tokenApi.updateTokenGoalProgress(TOKEN, "g1", 20)).toMatchObject({
      memberId: "m1",
    });
    expect(rpc).toHaveBeenLastCalledWith("view_goal_progress", {
      p_token: TOKEN,
      p_id: "g1",
      p_progress: 20,
    });
    await tokenApi.appendTokenGoalComment(TOKEN, "g1", "On track");
    expect(rpc).toHaveBeenLastCalledWith("append_goal_comment", {
      p_token: TOKEN,
      p_id: "g1",
      p_text: "On track",
    });
    rpc.mockResolvedValueOnce({ data: [goalRow], error: null });
    expect(await tokenApi.listTokenGoals(TOKEN)).toHaveLength(1);
  });

  it("validates token format before calling the backend", async () => {
    expect(tokenApi.isValidToken(TOKEN)).toBe(true);
    expect(tokenApi.isValidToken("abc")).toBe(false);
    expect(await tokenApi.resolveToken("abc")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolves token info", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ link_kind: "view", member_name: "Ada", member_role: null, template_id: "D2" }],
      error: null,
    });
    expect(await tokenApi.resolveToken(TOKEN)).toEqual({
      linkKind: "view",
      name: "Ada",
      role: "",
      templateId: "D2",
    });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await tokenApi.resolveToken(TOKEN)).toBeNull();
  });

  it("maps RPC payloads and surfaces errors", async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    await tokenApi.saveSelfEvaluation(TOKEN, input);
    expect(rpc).toHaveBeenLastCalledWith("self_save", {
      p_token: TOKEN,
      p_status: "published",
      p_current: { Technology: 3 },
      p_goal: {},
      p_comments: {},
    });

    await tokenApi.updateSelfEvaluationDraft(TOKEN, "e1", input);
    expect(rpc).toHaveBeenLastCalledWith("self_update_draft", {
      p_token: TOKEN,
      p_id: "e1",
      p_status: "published",
      p_current: { Technology: 3 },
      p_goal: {},
      p_comments: {},
    });

    await tokenApi.submitPeerEvaluation(TOKEN, input);
    expect(rpc).toHaveBeenLastCalledWith(
      "peer_submit",
      expect.objectContaining({ p_author: "Bob" })
    );

    rpc.mockResolvedValue({ data: [row], error: null });
    expect((await tokenApi.getPublicView(TOKEN))[0]?.memberId).toBe("m1");

    rpc.mockResolvedValue({ data: null, error: { message: "invalid link" } });
    await expect(tokenApi.deleteSelfEvaluation(TOKEN, "e1")).rejects.toThrow("invalid link");
  });
});

describe("token stores", () => {
  beforeEach(() => rpc.mockReset());

  it("self store loads history and manages its own versions", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ link_kind: "self", member_name: "Ada", member_role: "Dev", template_id: null }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [row], error: null });
    const store = createSelfTokenStore(TOKEN);
    const snapshot = await store.load();
    expect(snapshot?.profile.name).toBe("Ada");
    expect(snapshot?.evaluations).toHaveLength(1);

    rpc.mockResolvedValueOnce({ data: row, error: null });
    const updated = await store.updateDraft?.("e1", input);
    expect(updated?.id).toBe("e1");

    rpc.mockResolvedValue({ data: null, error: null });
    await store.setStatus("e1", "published");
    expect(rpc).toHaveBeenLastCalledWith("self_set_status", {
      p_token: TOKEN,
      p_id: "e1",
      p_status: "published",
    });
    rpc.mockClear();
    await expect(store.remove("e1")).rejects.toThrow("cannot delete");
    expect(rpc).not.toHaveBeenCalled();
    expect(store.canDelete(snapshot!.evaluations[0]!)).toBe(false);
  });

  it("self store rejects links of another kind", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ link_kind: "peer", member_name: "Ada", member_role: "", template_id: null }],
      error: null,
    });
    expect(await createSelfTokenStore(TOKEN).load()).toBeNull();
  });

  it("peer store is write-only", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ link_kind: "peer", member_name: "Ada", member_role: "", template_id: null }],
      error: null,
    });
    const store = createPeerTokenStore(TOKEN);
    expect((await store.load())?.evaluations).toEqual([]);
    rpc.mockResolvedValueOnce({ data: "new-id", error: null });
    const created = await store.create(input);
    expect(created.kind).toBe("peer");
    expect(store.showHistory).toBe(false);
    expect(store.canChangeStatus(created)).toBe(false);
  });
});
