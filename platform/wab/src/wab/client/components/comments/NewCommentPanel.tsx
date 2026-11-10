import CommentPostForm from "@/wab/client/components/comments/CommentPostForm";
import {
  CommentSubjectName,
  CommentSubjectType,
} from "@/wab/client/components/comments/CommentSubjectInputs";
import { useCommentPanelStyles } from "@/wab/client/components/comments/CommentThreadPanel";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { useI18n } from "@/wab/client/i18n";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { OpenedNewThread } from "@/wab/client/studio-ctx/comments-ctx";
import { getSetOfPinnedVariantsForViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert, ensure } from "@/wab/shared/common";
import { AimOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Flex } from "antd";
import * as React from "react";

export function NewCommentPanel({
  openedNewThread,
}: {
  openedNewThread: OpenedNewThread;
}) {
  const studio = useStudioCtx();
  useStudioArena(studio, (state) => state.current);
  const { t } = useI18n();
  const { styles } = useCommentPanelStyles();
  const ctx = studio.commentsCtx;
  const arena = studio.currentArena;
  if (!arena) {
    return null;
  }
  const subject = openedNewThread.tpl;
  return (
    <section className={styles.root} aria-label={t("New comment")}>
      <Flex component="header" justify="space-between" align="center" className={styles.header}>
        <Button
          type="text"
          className={styles.back}
          icon={<ArrowLeftOutlined />}
          aria-label={t("Back to comments")}
          onClick={() => ctx.closeNewThreadDialog()}
        >
          {t("New comment")}
        </Button>
        <PanelCloseButton onClick={() => studio.collapseRightPanel()} />
      </Flex>
      <Flex align="center" gap={9} className={styles.context}>
        <span className={styles.locationIcon}>
          <AimOutlined />
        </span>
        <Flex vertical>
          <span className={styles.locationName}>
            <CommentSubjectName
              studio={studio}
              subject={subject}
              fallback={t("Unnamed element")}
            />
          </span>
          <span className={styles.secondary}>
            <CommentSubjectType
              view={openedNewThread.viewCtx}
              subject={subject}
            />
          </span>
        </Flex>
      </Flex>
      <div style={{ flex: 1, minHeight: 0 }} />
      <footer className={styles.composer}>
        <CommentPostForm
          key={subject.uuid}
          id="new"
          initialRows={4}
          defaultValue={ctx.getArenaDraft(arena)}
          onChange={(value) => ctx.setArenaDraft(arena, value)}
          onSubmit={async (value) => {
            let address = ctx.bundler().addrOf(subject);
            if (studio.needsSaving() && !address) {
              await studio.save();
            }
            assert(
              ctx.openedNewThread() === openedNewThread &&
                !openedNewThread.viewCtx.disposeSignal.aborted,
              "Comment target is no longer available",
            );
            address = ctx.bundler().addrOf(subject);
            const thread = ctx.postRootComment({
              body: value,
              location: {
                subject: ensure(address, "Comment subject address must exist"),
                variants: getSetOfPinnedVariantsForViewCtx(
                  openedNewThread.viewCtx,
                  ctx.bundler(),
                ).map((v) =>
                  ensure(
                    ctx.bundler().addrOf(v),
                    "Comment variant address must exist",
                  ),
                ),
              },
            });
            ctx.clearArenaDraft(arena);
            ctx.closeNewThreadDialog();
            ctx.openCommentThreadDialog(thread.id, true);
          }}
        />
      </footer>
    </section>
  );
}
