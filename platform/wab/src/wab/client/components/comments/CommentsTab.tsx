import RootComment from "@/wab/client/components/comments/RootComment";
import {
  CommentFilter,
  FilterValueToLabel,
  partitionThreadsForFrames,
} from "@/wab/client/components/comments/utils";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCommentsTabProps } from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicCommentsTab";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  AnyArena,
  getArenaFrames,
  isDedicatedArena,
} from "@/wab/shared/Arenas";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Flex,
  Select,
  Skeleton,
  Typography,
} from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useCommentsStyles = createStyles(({ token }) => ({
  root: {
    padding: 16,
    color: token.colorText,
    background: token.colorBgContainer,
    minHeight: "100%",
  },
  toolbar: { marginBottom: 16 },
  heading: { margin: "16px 0 8px" },
  threads: { display: "flex", flexDirection: "column", gap: 12 },
}));

export const DEFAULT_NOTIFICATION_LEVEL = "mentions-and-replies";
export const notifyAboutKeyToLabel = {
  all: "Everything",
  "mentions-and-replies": "Mentions and replies",
  none: "None",
} as const;

export type CommentsTabProps = DefaultCommentsTabProps;

function getArenaDetails(currentArena: AnyArena) {
  const isDedicatedCurrentArena = isDedicatedArena(currentArena);
  if (isDedicatedCurrentArena) {
    return {
      name: currentArena.component.name,
      type: currentArena.component.type,
      currentFrames: getArenaFrames(currentArena),
    };
  } else {
    return {
      name: currentArena.name,
      type: "Arena",
      currentFrames: currentArena.children,
    };
  }
}

export const CommentsTab = observer(function CommentsTab(
  _props: CommentsTabProps,
) {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const { styles } = useCommentsStyles();
  const [savingNotification, setSavingNotification] = React.useState(false);
  const [notificationError, setNotificationError] = React.useState(false);

  const currentArena = studioCtx.currentArena;
  if (!currentArena) {
    return null;
  }

  const commentsCtx = studioCtx.commentsCtx;

  const threads = commentsCtx.filteredThreads();

  const { currentFrames, name } = getArenaDetails(currentArena);

  const { current, other } = partitionThreadsForFrames(
    threads,
    currentFrames,
    studioCtx,
  );

  const projectId = studioCtx.siteInfo.id;
  const branchId = studioCtx.branchInfo()?.id;

  const currentNotificationLevel =
    commentsCtx.selfNotificationSettings()?.notifyAbout ??
    DEFAULT_NOTIFICATION_LEVEL;

  const changeNotification = async (
    notifyAbout: keyof typeof notifyAboutKeyToLabel,
  ) => {
    setSavingNotification(true);
    setNotificationError(false);
    try {
      await studioCtx.appCtx.api.updateNotificationSettings(
        projectId,
        branchId,
        {
          ...commentsCtx.selfNotificationSettings(),
          notifyAbout,
        },
      );
      await commentsCtx.fetchComments();
    } catch {
      setNotificationError(true);
    } finally {
      setSavingNotification(false);
    }
  };

  const renderThreads = (items: typeof threads) => (
    <div className={styles.threads}>
      {items.map((commentThread) => (
        <RootComment key={commentThread.id} commentThread={commentThread} />
      ))}
    </div>
  );

  return (
    <Scrollbar
      className="comments-tab flex-even"
      scrollX={false}
      style={{ minHeight: 0 }}
    >
      <section className={styles.root}>
        <Flex
          justify="space-between"
          align="center"
          gap={8}
          className={styles.toolbar}
        >
          <Typography.Text strong>{uiT("Comments")}</Typography.Text>
          <Select<CommentFilter>
            aria-label={uiT("Comment filter")}
            value={commentsCtx.commentsFilter()}
            onChange={(value) => commentsCtx.setCommentsFilter(value)}
            options={(["all", "mentions-and-replies", "resolved"] as const).map(
              (value) => ({ value, label: uiT(FilterValueToLabel[value]) }),
            )}
          />
        </Flex>
        <Flex vertical gap={8}>
          <Typography.Text type="secondary">
            {uiT("Notify me about")}
          </Typography.Text>
          <Select<keyof typeof notifyAboutKeyToLabel>
            aria-label={uiT("Notify me about")}
            value={currentNotificationLevel}
            loading={savingNotification}
            disabled={savingNotification}
            onChange={(value) => {
              void changeNotification(value);
            }}
            options={(["all", "mentions-and-replies", "none"] as const).map(
              (value) => ({ value, label: uiT(notifyAboutKeyToLabel[value]) }),
            )}
          />
          {notificationError && (
            <Alert
              type="error"
              showIcon
              title={uiT("Failed to update comment notifications")}
            />
          )}
          {commentsCtx.loadFailed && (
            <Alert
              type="error"
              showIcon
              title={uiT("Failed to load comments")}
              action={
                <Button
                  size="small"
                  loading={commentsCtx.isLoading}
                  onClick={() => {
                    void commentsCtx.fetchComments();
                  }}
                >
                  {uiT("Retry")}
                </Button>
              }
            />
          )}
        </Flex>
        {!commentsCtx.hasLoaded && commentsCtx.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <>
            <Flex align="center" gap={8} className={styles.heading}>
              <Typography.Text strong>{name}</Typography.Text>
              <Badge count={current.length} showZero />
            </Flex>
            {current.length
              ? renderThreads(current)
              : commentsCtx.hasLoaded && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={uiT("No comments")}
                  />
                )}
            {other.length > 0 && (
              <>
                <Flex align="center" gap={8} className={styles.heading}>
                  <Typography.Text strong>{uiT("Other pages")}</Typography.Text>
                  <Badge count={other.length} />
                </Flex>
                {renderThreads(other)}
              </>
            )}
          </>
        )}
      </section>
    </Scrollbar>
  );
});

export default CommentsTab;
