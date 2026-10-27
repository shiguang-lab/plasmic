import { showError } from "@/wab/client/ErrorNotifications";
import RootComment from "@/wab/client/components/comments/RootComment";
import { CommentFilters } from "@/wab/client/components/comments/utils";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCommentsTabProps } from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicCommentsTab";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Checkbox, Dropdown, Flex, Segmented, Skeleton, Tooltip, Typography } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useCommentsStyles = createStyles(({ token }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    color: token.colorText,
    background: token.colorBgContainer,
    fontSize: 12,
  },
  header: {
    flexShrink: 0,
    padding: "12px 16px 14px",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  toolbar: { marginBottom: 12 },
  filterOptions: { marginTop: 12 },
  title: { fontSize: 14 },
  filters: {
    width: "100%",
    fontSize: 12,
    padding: 3,
    "& .ant-segmented-group": { alignItems: "stretch" },
    "& .ant-segmented-item": { minWidth: 0 },
    "& .ant-segmented-item-label": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      minHeight: 28,
      padding: "5px 6px",
      lineHeight: "18px",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
    },
  },
  content: { padding: "16px" },
  statusButton: { padding: 0, fontSize: 12 },
  related: { fontSize: 12, marginInlineStart: "auto" },
  threads: { display: "flex", flexDirection: "column", gap: 8 },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "44px 12px 48px",
    textAlign: "center",
  },
  emptyIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    marginBottom: 16,
    borderRadius: token.borderRadiusLG,
    color: token.colorTextSecondary,
    background: token.colorFillTertiary,
    fontSize: 20,
  },
  emptyTitle: { fontWeight: 500, marginBottom: 6 },
  emptyHint: {
    maxWidth: 240,
    color: token.colorTextSecondary,
    lineHeight: "20px",
  },
}));

const statusLabels = {
  unresolved: "Unresolved",
  resolved: "Resolved",
  all: "All comments",
} as const;

const emptyMessages = {
  unresolved: {
    title: "No open comments",
    hint: "Select an element on the canvas to add a comment.",
  },
  all: {
    title: "No comments",
    hint: "Select an element on the canvas to add a comment.",
  },
  resolved: {
    title: "No resolved comments",
    hint: "Resolved discussions will appear here.",
  },
} as const;

export const DEFAULT_NOTIFICATION_LEVEL = "mentions-and-replies";
export const notifyAboutKeyToLabel = {
  all: "Everything",
  "mentions-and-replies": "Mentions and replies",
  none: "None",
} as const;

export type CommentsTabProps = DefaultCommentsTabProps;

export const CommentsTab = observer(function CommentsTab(
  _props: CommentsTabProps,
) {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const { styles } = useCommentsStyles();
  const [savingNotification, setSavingNotification] = React.useState(false);

  const commentsCtx = studioCtx.commentsCtx;
  const filters = commentsCtx.commentsFilter();
  const threads = commentsCtx.filteredThreads();

  const projectId = studioCtx.siteInfo.id;
  const branchId = studioCtx.branchInfo()?.id;

  const currentNotificationLevel =
    commentsCtx.selfNotificationSettings()?.notifyAbout ??
    DEFAULT_NOTIFICATION_LEVEL;

  const changeNotification = async (
    notifyAbout: keyof typeof notifyAboutKeyToLabel,
  ) => {
    setSavingNotification(true);
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
    } catch (error) {
      showError(error, { title: "Failed to update comment notifications" });
    } finally {
      setSavingNotification(false);
    }
  };

  const renderThreads = (items: typeof threads) => (
    <div className={styles.threads}>
      {items.map((commentThread) => (
        <RootComment
          key={commentThread.id}
          commentThread={commentThread}
          showLocation={filters.scope === "project"}
        />
      ))}
    </div>
  );

  return (
    <section
      className={`comments-tab flex-even ${styles.root}`}
      aria-label={uiT("Comments")}
    >
      <header className={styles.header}>
        <Flex
          justify="space-between"
          align="center"
          gap={8}
          className={styles.toolbar}
        >
          <Typography.Text strong className={styles.title}>
            {uiT("Comments")}
          </Typography.Text>
          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              selectedKeys: [currentNotificationLevel],
              items: [
                {
                  key: "notifications",
                  type: "group",
                  label: uiT("Notify me about"),
                  children: (
                    ["all", "mentions-and-replies", "none"] as const
                  ).map((value) => ({
                    key: value,
                    label: uiT(notifyAboutKeyToLabel[value]),
                    icon: (
                      <CheckOutlined
                        style={{
                          visibility:
                            value === currentNotificationLevel
                              ? "visible"
                              : "hidden",
                        }}
                      />
                    ),
                    disabled: savingNotification,
                    onClick: () => {
                      void changeNotification(value);
                    },
                  })),
                },
              ],
            }}
            styles={{ root: { minWidth: 240, maxWidth: "calc(100vw - 24px)" } }}
          >
            <Tooltip
              title={`${uiT("Notify me about")}: ${uiT(notifyAboutKeyToLabel[currentNotificationLevel])}`}
            >
              <Button
                type="text"
                size="small"
                aria-label={uiT("Notify me about")}
                icon={<BellOutlined />}
                loading={savingNotification}
                disabled={savingNotification}
              />
            </Tooltip>
          </Dropdown>
        </Flex>
        <Segmented<CommentFilters["scope"]>
          block
          className={styles.filters}
          aria-label={uiT("Comment scope")}
          value={filters.scope}
          onChange={(scope) =>
            commentsCtx.setCommentsFilter({ ...filters, scope })
          }
          options={[
            { value: "current", label: uiT("Current page") },
            { value: "project", label: uiT("Entire project") },
          ]}
        />
        <Flex align="center" gap={8} wrap className={styles.filterOptions}>
          <Dropdown
            trigger={["click"]}
            placement="bottomLeft"
            menu={{
              selectedKeys: [filters.status],
              items: (["unresolved", "resolved", "all"] as const).map(
                (status) => ({
                  key: status,
                  label: uiT(statusLabels[status]),
                  onClick: () =>
                    commentsCtx.setCommentsFilter({ ...filters, status }),
                }),
              ),
            }}
            styles={{ root: { minWidth: 180 } }}
          >
            <Button
              type="text"
              size="small"
              className={styles.statusButton}
              aria-label={uiT("Comment status")}
            >
              {uiT(statusLabels[filters.status])}
              <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Checkbox
            className={styles.related}
            checked={filters.onlyRelated}
            onChange={(event) =>
              commentsCtx.setCommentsFilter({
                ...filters,
                onlyRelated: event.target.checked,
              })
            }
          >
            {uiT("Related to me")}
          </Checkbox>
        </Flex>
      </header>
      <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
        <div className={styles.content}>
          {commentsCtx.loadFailed && (
            <Button size="small" loading={commentsCtx.isLoading}
              onClick={() => { void commentsCtx.fetchComments(); }}>
              {uiT("Retry")}
            </Button>
          )}
          {!commentsCtx.hasLoaded && !commentsCtx.loadFailed ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : threads.length ? (
            renderThreads(threads)
          ) : (
            commentsCtx.hasLoaded && (
              <div className={styles.empty} role="status">
                <span className={styles.emptyIcon} aria-hidden="true">
                  {filters.status === "resolved" ? (
                    <CheckOutlined />
                  ) : (
                    <MessageOutlined />
                  )}
                </span>
                <div className={styles.emptyTitle}>
                  {uiT(
                    filters.onlyRelated
                      ? "No comments related to you"
                      : emptyMessages[filters.status].title,
                  )}
                </div>
                <div className={styles.emptyHint}>
                  {uiT(
                    filters.onlyRelated
                      ? "Comments you started, replied to, or were mentioned in will appear here."
                      : emptyMessages[filters.status].hint,
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </Scrollbar>
    </section>
  );
});

export default CommentsTab;
