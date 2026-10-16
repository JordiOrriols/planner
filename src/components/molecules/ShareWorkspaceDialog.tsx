import React from "react";
import { Button, Modal, ShareAccessDialog } from "@jordiorriols/ui";
import { useShareAccessForm } from "@jordiorriols/ui/hooks";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import type { WorkspaceAccess } from "@/types/planner";

export function ShareWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { repository, user } = useData();
  const { workspace, refresh } = useWorkspace();
  const { t } = useTranslation();
  if (!repository) throw new Error(t("copy.signInBeforeSharingAWorkspace"));
  const query = useQuery({
    queryKey: ["planner-workspace-shares", user?.id, workspace.id],
    queryFn: () => repository.listWorkspaceShares(workspace.id),
  });
  async function updated() {
    await Promise.all([query.refetch({ throwOnError: true }), refresh()]);
  }
  const form = useShareAccessForm<WorkspaceAccess>({
    isOpen: true,
    initialAccess: "viewer",
    onShare: async (email, access) => {
      await repository.shareWorkspace(workspace.id, email, access);
      await updated();
    },
    onChangeAccess: async (account, access) => {
      await repository.updateWorkspaceShare(workspace.id, account, access);
      await updated();
    },
    onRemove: async (account) => {
      await repository.removeWorkspaceShare(workspace.id, account);
      await updated();
    },
  });
  if (query.error) {
    return (
      <Modal
        isOpen
        title={t("teams.shareTitle", { name: workspace.name })}
        description={t("teams.shareDescription")}
        closeLabel={t("buttons.close")}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <p role="alert">{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>{t("planner.retry")}</Button>
      </Modal>
    );
  }
  return (
    <ShareAccessDialog
      isOpen
      onClose={onClose}
      loading={query.isPending}
      form={form}
      entries={(query.data ?? []).map((share) => ({
        id: share.user_id,
        email: share.email,
        access: share.access_level,
      }))}
      options={[
        { value: "viewer", label: t("teams.viewer") },
        { value: "editor", label: t("teams.editor") },
      ]}
      labels={{
        title: t("teams.shareTitle", { name: workspace.name }),
        description: t("teams.shareDescription"),
        email: t("auth.email"),
        permission: t("teams.permission"),
        share: t("teams.share"),
        loading: t("pageMessage.loading"),
        empty: t("planner.noShares"),
        close: t("buttons.close"),
        permissionFor: (email) => t("teams.permissionFor", { email }),
        remove: (email) => t("teams.removeShare", { email }),
      }}
    />
  );
}
