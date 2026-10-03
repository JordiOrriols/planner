import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VERTICALS } from "@/components/atoms/levelSelector";
import { computeAverage, latestOf } from "@/data/evaluations";
import type { EvaluationStore } from "@/data/evaluationStore";
import type {
  CommentMap,
  Evaluation,
  EvaluationStatus,
  LevelMap,
  MemberProfile,
  TeamMember,
} from "@/types";
import { useVersionSelection } from "./useVersionSelection";

type FormState = { currentLevels: LevelMap; goalLevels: LevelMap; comments: CommentMap };
type LoadState = "loading" | "ready" | "notFound" | "error";
export type AutosaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_FORM: FormState = { currentLevels: {}, goalLevels: {}, comments: {} };
const EMPTY_PROFILE: MemberProfile = { name: "", role: "", templateId: null };
const AUTOSAVE_DELAY = 500;

const formFrom = (evaluation: Evaluation | undefined): FormState =>
  evaluation
    ? {
        currentLevels: evaluation.currentLevels,
        goalLevels: evaluation.goalLevels,
        comments: evaluation.comments,
      }
    : EMPTY_FORM;

const sameMap = <T extends string | number>(a: Record<string, T>, b: Record<string, T>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
};

const sameForm = (a: FormState, b: FormState) =>
  sameMap(a.currentLevels, b.currentLevels) &&
  sameMap(a.goalLevels, b.goalLevels) &&
  sameMap(a.comments, b.comments);

const normalizedProfile = (profile: MemberProfile): MemberProfile => ({
  ...profile,
  name: profile.name.trim(),
  role: profile.role.trim(),
});

const sameProfile = (a: MemberProfile, b: MemberProfile) =>
  a.name === b.name && a.role === b.role && a.templateId === b.templateId;

export class EditorValidationError extends Error {}

/** Shared editor for manager, self and peer evaluations. */
export function useEvaluationEditor(store: EvaluationStore) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<MemberProfile>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<MemberProfile>(EMPTY_PROFILE);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedVertical, setExpandedVertical] = useState<string | null>(VERTICALS[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");

  const draftRef = useRef<Evaluation | null>(null);
  const latestRef = useRef({ form: EMPTY_FORM, profile: EMPTY_PROFILE });
  const savedProfileRef = useRef<MemberProfile>(EMPTY_PROFILE);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<number | null>(null);

  const selection = useVersionSelection(evaluations, store.kind);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const snapshot = await store.load();
      if (!snapshot) {
        setLoadState("notFound");
        return;
      }
      const latest = latestOf(snapshot.evaluations, store.kind);
      const availableDraft = snapshot.evaluations.find(
        (evaluation) => evaluation.kind === store.kind && evaluation.status === "draft"
      );
      const draft =
        store.kind === "self" ? (latest?.status === "draft" ? latest : undefined) : availableDraft;
      const initial = store.kind === "self" ? draft : (draft ?? latest);
      const initialForm = formFrom(initial);
      setProfile(snapshot.profile);
      setSavedProfile(snapshot.profile);
      savedProfileRef.current = snapshot.profile;
      setMember(snapshot.member ?? null);
      setEvaluations(snapshot.evaluations);
      setForm(initialForm);
      setEditingId(initial?.id ?? null);
      draftRef.current = availableDraft ?? null;
      latestRef.current = { form: initialForm, profile: snapshot.profile };
      setAutosaveState(draft ? "saved" : "idle");
      setLoadState("ready");
    } catch (error) {
      console.error("Failed to load evaluations", error);
      setLoadState("error");
    }
  }, [store]);

  useEffect(() => void load(), [load]);

  const selectedEvaluation = useMemo(
    () => evaluations.find((evaluation) => evaluation.id === editingId),
    [editingId, evaluations]
  );
  const baselineEvaluation =
    selectedEvaluation ?? (store.kind === "self" ? undefined : latestOf(evaluations, store.kind));
  const contentChanged = !sameForm(form, formFrom(baselineEvaluation));
  const profileChanged = !sameProfile(normalizedProfile(profile), savedProfile);
  const dirty = contentChanged || profileChanged;
  const draft = evaluations.find(
    (evaluation) => evaluation.kind === store.kind && evaluation.status === "draft"
  );

  useEffect(() => {
    latestRef.current = { form, profile };
  }, [form, profile]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const persistLatest = useCallback(async () => {
    if (store.kind === "peer" || loadState !== "ready") return;
    const snapshot = latestRef.current;
    const nextProfile = normalizedProfile(snapshot.profile);
    if (store.editableProfile && !nextProfile.name) return;

    setAutosaveState("saving");
    try {
      if (store.editableProfile && !sameProfile(nextProfile, savedProfileRef.current)) {
        await store.saveProfile(nextProfile);
        savedProfileRef.current = nextProfile;
        setSavedProfile(nextProfile);
        setProfile(nextProfile);
      }
      const source =
        store.kind === "self" && editingId === null
          ? undefined
          : (draftRef.current ?? baselineEvaluation);
      if (!sameForm(snapshot.form, formFrom(source))) {
        const input = {
          status: "draft" as const,
          authorName: store.kind === "self" ? nextProfile.name : null,
          ...snapshot.form,
        };
        const saved = draftRef.current
          ? await store.updateDraft!(draftRef.current.id, input)
          : await store.create(input);
        draftRef.current = saved;
        setEvaluations((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setEditingId(saved.id);
      }
      setAutosaveState("saved");
    } catch (error) {
      console.error("Failed to autosave draft", error);
      setAutosaveState("error");
    }
  }, [baselineEvaluation, editingId, loadState, store]);

  const enqueueAutosave = useCallback(() => {
    queueRef.current = queueRef.current.then(persistLatest);
    return queueRef.current;
  }, [persistLatest]);

  useEffect(() => {
    if (store.kind === "peer" || loadState !== "ready" || !dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setAutosaveState("idle");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void enqueueAutosave();
    }, AUTOSAVE_DELAY);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dirty, enqueueAutosave, form, loadState, profile, store.kind]);

  const flushAutosave = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await enqueueAutosave();
  }, [enqueueAutosave]);

  const save = useCallback(
    async (status: EvaluationStatus) => {
      if (store.editableProfile && !profile.name.trim()) {
        throw new EditorValidationError("nameRequired");
      }
      if (store.kind === "peer" && !authorName.trim()) {
        throw new EditorValidationError("authorRequired");
      }

      setSaving(true);
      try {
        if (store.kind !== "peer") {
          await flushAutosave();
          const currentDraft = draftRef.current;
          if (!currentDraft || autosaveState === "error") {
            throw new EditorValidationError("publishDraftFirst");
          }
          await store.setStatus(currentDraft.id, "published");
          const published = { ...currentDraft, status: "published" as const };
          draftRef.current = null;
          setEvaluations((prev) =>
            prev.map((evaluation) => (evaluation.id === currentDraft.id ? published : evaluation))
          );
          setEditingId(published.id);
          setAutosaveState("saved");
          return published;
        }

        const submittedEvaluation = await store.create({
          status,
          authorName: authorName.trim(),
          ...form,
        });
        setSubmitted(true);
        setForm(EMPTY_FORM);
        return submittedEvaluation;
      } finally {
        setSaving(false);
      }
    },
    [authorName, autosaveState, flushAutosave, form, profile.name, store]
  );

  /** Own-kind versions load into the form; other kinds toggle on the radar. */
  const selectVersion = useCallback(
    (id: string) => {
      const evaluation = evaluations.find((item) => item.id === id);
      if (!evaluation) return;
      if (evaluation.kind !== store.kind) {
        selection.toggleCompare(id);
        return;
      }
      setEditingId(id);
      setForm(formFrom(evaluation));
    },
    [evaluations, selection, store.kind]
  );

  const deleteVersion = useCallback(
    async (evaluation: Evaluation) => {
      if (!store.canDelete(evaluation)) throw new Error("Deletion is not allowed");
      await store.remove(evaluation.id);
      if (draftRef.current?.id === evaluation.id) draftRef.current = null;
      const remaining = evaluations.filter((item) => item.id !== evaluation.id);
      setEvaluations(remaining);
      if (editingId === evaluation.id) {
        const next = latestOf(remaining, store.kind);
        setEditingId(next?.id ?? null);
        setForm(formFrom(next));
      }
    },
    [editingId, evaluations, store]
  );

  const changeVersionStatus = async (evaluation: Evaluation, status: EvaluationStatus) => {
    if (!store.canChangeStatus(evaluation) || evaluation.kind !== "peer") {
      throw new Error("Status change is not allowed");
    }
    await store.setStatus(evaluation.id, status);
    setEvaluations((current) =>
      current.map((item) => (item.id === evaluation.id ? { ...item, status } : item))
    );
  };

  const updateForm = useCallback((patch: (prev: FormState) => FormState) => setForm(patch), []);
  const updateProfile = useCallback(
    (patch: Partial<MemberProfile>) => setProfile((prev) => ({ ...prev, ...patch })),
    []
  );
  const toggleVertical = useCallback(
    (vertical: string) => setExpandedVertical((prev) => (prev === vertical ? null : vertical)),
    []
  );
  const handleCurrentChange = useCallback(
    (vertical: string, level: number) =>
      updateForm((prev) => ({
        ...prev,
        currentLevels: { ...prev.currentLevels, [vertical]: level },
      })),
    [updateForm]
  );
  const handleGoalChange = useCallback(
    (vertical: string, level: number) =>
      updateForm((prev) => ({ ...prev, goalLevels: { ...prev.goalLevels, [vertical]: level } })),
    [updateForm]
  );
  const handleCommentChange = useCallback(
    (vertical: string, value: string) =>
      updateForm((prev) => ({ ...prev, comments: { ...prev.comments, [vertical]: value } })),
    [updateForm]
  );

  const compare = useMemo(
    () =>
      selection.sorted.filter(
        (item) => selection.compareIds.includes(item.id) && item.id !== editingId
      ),
    [selection.sorted, selection.compareIds, editingId]
  );
  const verticalStats = useMemo(
    () =>
      VERTICALS.map((vertical) => ({
        vertical,
        current: form.currentLevels[vertical] || 0,
        goal: form.goalLevels[vertical] || 0,
      })),
    [form]
  );

  return {
    loadState,
    profile,
    member,
    setMember,
    authorName,
    evaluations: selection.sorted,
    form,
    editingId,
    expandedVertical,
    dirty,
    contentChanged,
    profileChanged,
    autosaveState,
    canPublish:
      !saving && (store.kind === "peer" || (!!draft && autosaveState === "saved" && !dirty)),
    saving,
    submitted,
    compare,
    compareIds: selection.compareIds,
    currentAverage: computeAverage(form.currentLevels),
    goalAverage: computeAverage(form.goalLevels),
    verticalStats,
    memberId: store.memberId(),
    setName: (name: string) => updateProfile({ name }),
    setRole: (role: string) => updateProfile({ role }),
    setTemplateId: (templateId: string | null) => updateProfile({ templateId }),
    setAuthorName,
    handleCurrentChange,
    handleGoalChange,
    handleCommentChange,
    toggleVertical,
    selectVersion,
    toggleCompare: selection.toggleCompare,
    save,
    deleteVersion,
    changeVersionStatus,
    reload: load,
  };
}
