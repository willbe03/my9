"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareImagePreviewDialog } from "@/components/share/ShareImagePreviewDialog";
import { ShareLinkDialog } from "@/components/share/ShareLinkDialog";
import { SubjectKind, getSubjectKindMeta } from "@/lib/subject-kind";
import { ShareGame } from "@/lib/share/types";

type NoticeKind = "success" | "error" | "info";

interface SharePlatformActionsProps {
  kind: SubjectKind;
  shareId: string | null;
  games: Array<ShareGame | null>;
  creatorName?: string | null;
  onNotice: (kind: NoticeKind, message: string) => void;
}

export function SharePlatformActions({
  kind,
  shareId,
  games,
  creatorName,
  onNotice,
}: SharePlatformActionsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const kindMeta = getSubjectKindMeta(kind);
  const shareUrl = useMemo(() => {
    if (!shareId) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/${kind}/s/${shareId}`;
  }, [kind, shareId]);

  const shareTitle = useMemo(() => {
    const name = creatorName?.trim();
    if (!name) return kindMeta.shareTitle;
    return kindMeta.shareTitle.replace("我", name);
  }, [creatorName, kindMeta.shareTitle]);

  const disabled = !shareId;

  const baseClass =
    "inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 bg-white border-gray-200 text-gray-700 hover:bg-gray-50";

  return (
    <div className="grid w-full max-w-[42rem] grid-cols-1 gap-3 sm:grid-cols-2">
      <Button
        variant="default"
        className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-6 py-3 font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45 sm:order-2"
        data-testid="share-generate-image"
        disabled={disabled}
        onClick={() => {
          if (!shareId) return;
          setPreviewOpen(true);
        }}
      >
        生成分享图片
      </Button>

      <Button
        variant="outline"
        className={`${baseClass} order-2 sm:order-1`}
        data-testid="share-generate-link"
        disabled={disabled}
        onClick={() => {
          if (!shareUrl) return;
          setLinkDialogOpen(true);
        }}
      >
        生成分享链接
      </Button>

      {shareId ? (
        <ShareImagePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          kind={kind}
          shareId={shareId}
          title={shareTitle}
          games={games}
          creatorName={creatorName}
          onNotice={onNotice}
        />
      ) : null}
      {shareUrl ? (
        <ShareLinkDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          shareUrl={shareUrl}
          onNotice={onNotice}
        />
      ) : null}
    </div>
  );
}
