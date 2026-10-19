import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, ConfirmDialog } from "@jordiorriols/ui";
import { Share2 } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import type { PlannerRepository } from "@/data/plannerRepository";

export default function RoadmapSharing({
  workspace,
  repository,
}: {
  workspace: string;
  repository: PlannerRepository;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const action = useAsyncAction();
  const client = useQueryClient();
  const queryKey = ["roadmap-share", workspace];
  const query = useQuery({
    queryKey,
    enabled: open,
    queryFn: () => repository.roadmapShare(workspace),
  });
  const url = query.data ? `${window.location.href.split("#")[0]}#/roadmap/${query.data}` : "";
  const change = (enabled: boolean) =>
    void action.run(async () => {
      const token = await repository.roadmapShare(workspace, enabled);
      client.setQueryData(queryKey, token);
      setCopied(false);
      setRevoking(false);
    });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="size-4" />
        {t("publicRoadmap.share")}
      </Button>
      <Modal
        isOpen={open}
        onOpenChange={setOpen}
        title={t("publicRoadmap.share")}
        description={t("publicRoadmap.sharingDescription")}
        closeLabel={t("common.actions.cancel")}
      >
        <div className="space-y-4">
          {(action.error || query.error) && (
            <p role="alert" className="text-destructive">
              {action.error ?? query.error?.message}
            </p>
          )}
          {query.isPending ? (
            <p role="status">{t("app.loading.page")}</p>
          ) : (
            query.isSuccess &&
            (url ? (
              <>
                <Input
                  aria-label={t("publicRoadmap.link")}
                  value={url}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                      })
                    }
                  >
                    {t(copied ? "publicRoadmap.copied" : "publicRoadmap.copy")}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      {t("publicRoadmap.open")}
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={action.busy}
                    onClick={() => setRevoking(true)}
                  >
                    {t("publicRoadmap.revoke")}
                  </Button>
                </div>
              </>
            ) : (
              <Button disabled={action.busy} onClick={() => change(true)}>
                {t("publicRoadmap.create")}
              </Button>
            ))
          )}
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={revoking}
        title={t("publicRoadmap.revoke")}
        description={t("publicRoadmap.revokeDescription")}
        confirmLabel={t("publicRoadmap.revoke")}
        cancelLabel={t("common.actions.cancel")}
        onCancel={() => setRevoking(false)}
        onConfirm={() => change(false)}
      />
    </>
  );
}
