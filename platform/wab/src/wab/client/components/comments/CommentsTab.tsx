import commentsTabStyles from "./CommentsTab.module.less";
import { showError } from "@/wab/client/ErrorNotifications";
import { CommentThreadPanel } from "@/wab/client/components/comments/CommentThreadPanel";
import { NewCommentPanel } from "@/wab/client/components/comments/NewCommentPanel";
import RootComment from "@/wab/client/components/comments/RootComment";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import {
  CommentFilters,
  filterCommentThreads,
} from "@/wab/client/components/comments/utils";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCommentsTabProps } from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicCommentsTab";
import { CommentThreadId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Button,
  Checkbox,
  Dropdown,
  Flex,
  Segmented,
  Skeleton,
  Tooltip,
  Typography,
} from "antd";
import * as React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

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

export const CommentsTab = React.memo(function CommentsTab(
  _props: CommentsTabProps,
) {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();

  const [savingNotification, setSavingNotification] = React.useState(false);

  const commentsCtx = studioCtx.commentsCtx;
  const openedThread = useStore(
    commentsCtx.dialogStore,
    (state) => state.thread,
  );
  const openedNewThread = useStore(
    commentsCtx.dialogStore,
    (state) => state.newThread,
  );
  const listViewport = React.useRef<HTMLElement>(null);
  const listRoot = React.useRef<HTMLDivElement>(null);
  const scrollTop = React.useRef(0);
  const previousThread = React.useRef<CommentThreadId | undefined>(undefined);
  const filters = useStore(commentsCtx.filterStore, (state) => state);
  const currentComponents = useStore(
    studioCtx.arenaState.observedComponentsStore,
    (state) => (filters.scope === "current" ? state : undefined),
  );
  const allThreads = useStore(commentsCtx.store, (state) => state.allThreads);
  const { isLoading, loadFailed, hasLoaded, selfNotificationSettings } =
    useStore(
      commentsCtx.requestStore,
      useShallow((state) => ({
        isLoading: state.loadFailed && state.isLoading,
        loadFailed: state.loadFailed,
        hasLoaded: state.hasLoaded,
        selfNotificationSettings: state.selfNotificationSettings,
      })),
    );
  const threads = filterCommentThreads(
    allThreads,
    filters,
    new Set(currentComponents?.map((ref) => ref.uid)),
    ensure(
      studioCtx.appCtx.selfInfo,
      "Comment filters require a signed-in user",
    ),
  );
  const selectedId = openedThread?.threadId;
  const [navigation, setNavigation] = React.useState<{
    selectedId?: CommentThreadId;
    ids: CommentThreadId[];
  }>({ ids: [] });
  if (selectedId !== navigation.selectedId) {
    const ids = navigation.selectedId
      ? navigation.ids
      : threads.map((thread) => thread.id);
    setNavigation({
      selectedId,
      ids: selectedId
        ? ids.includes(selectedId)
          ? ids
          : [...ids, selectedId]
        : [],
    });
  }
  React.useLayoutEffect(() => {
    if (openedThread) {
      previousThread.current = openedThread.threadId;
    } else if (!openedNewThread) {
      if (listViewport.current) {
        listViewport.current.scrollTop = scrollTop.current;
      }
      const target = Array.from(
        listRoot.current?.querySelectorAll<HTMLButtonElement>(
          "[data-comment-thread]",
        ) ?? [],
      ).find((node) => node.dataset.commentThread === previousThread.current);
      target?.focus({ preventScroll: true });
    }
  }, [openedThread, openedNewThread]);

  const projectId = studioCtx.siteInfo.id;
  const branchId = studioCtx.branchInfo()?.id;

  const currentNotificationLevel =
    selfNotificationSettings?.notifyAbout ?? DEFAULT_NOTIFICATION_LEVEL;

  const changeNotification = async (
    notifyAbout: keyof typeof notifyAboutKeyToLabel,
  ) => {
    setSavingNotification(true);
    return await (async () => {
      await studioCtx.appCtx.api.updateNotificationSettings(
        projectId,
        branchId,
        {
          ...selfNotificationSettings,
          notifyAbout,
        },
      );
      await commentsCtx.fetchComments();
    })()
      .catch(async (error) => {
        showError(error, { title: "Failed to update comment notifications" });
      })
      .finally(() => {
        setSavingNotification(false);
      });
  };

  const renderThreads = (items: typeof threads) => (
    <div className={commentsTabStyles.threads}>
      {items.map((commentThread) => (
        <RootComment
          key={commentThread.id}
          commentThread={commentThread}
          showLocation={filters.scope === "project"}
          onOpen={() => {
            scrollTop.current = listViewport.current?.scrollTop ?? 0;
          }}
        />
      ))}
    </div>
  );

  return (
    <section
      className={`comments-tab flex-even ${commentsTabStyles.root}`}
      aria-label={uiT("Comments")}
    >
      {openedThread && (
        <CommentThreadPanel
          openedThread={openedThread}
          navigationIds={navigation.ids}
        />
      )}
      {openedNewThread && <NewCommentPanel openedNewThread={openedNewThread} />}
      <div
        ref={listRoot}
        style={{
          display: openedThread || openedNewThread ? "none" : "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
        aria-hidden={!!(openedThread || openedNewThread)}
      >
        <header className={commentsTabStyles.header}>
          <Flex
            justify="space-between"
            align="center"
            gap={8}
            className={commentsTabStyles.toolbar}
          >
            <Flex align="center" gap={4}>
              <Typography.Text strong className={commentsTabStyles.title}>
                {uiT("Comments")}{" "}
                <span className={commentsTabStyles.emptyHint}>{threads.length}</span>
              </Typography.Text>
              {!studioCtx.isPublishedTemplate && <Dropdown
                trigger={["click"]}
                placement="bottomLeft"
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
                styles={{
                  root: { minWidth: 240, maxWidth: "calc(100vw - 24px)" },
                }}
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
              </Dropdown>}
            </Flex>
            <PanelCloseButton onClick={() => studioCtx.collapseRightPanel()} />
          </Flex>
          <Segmented<CommentFilters["scope"]>
            block
            className={commentsTabStyles.filters}
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
          <Flex align="center" gap={8} wrap className={commentsTabStyles.filterOptions}>
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
                className={commentsTabStyles.statusButton}
                aria-label={uiT("Comment status")}
              >
                {uiT(statusLabels[filters.status])}
                <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Checkbox
              className={commentsTabStyles.related}
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
        <Scrollbar
          ref={listViewport}
          scrollX={false}
          style={{ flex: 1, minHeight: 0 }}
          events={{
            scroll: () => {
              if (!openedThread && !openedNewThread) {
                scrollTop.current = listViewport.current?.scrollTop ?? 0;
              }
            },
          }}
        >
          <div className={commentsTabStyles.content}>
            {loadFailed && (
              <Alert
                type="error"
                showIcon
                title={uiT("Failed to fetch comments for project")}
                action={
                  <Button
                    size="small"
                    loading={isLoading}
                    onClick={() => {
                      void commentsCtx.fetchComments();
                    }}
                  >
                    {uiT("Retry")}
                  </Button>
                }
              />
            )}
            {!hasLoaded && !loadFailed ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : threads.length ? (
              renderThreads(threads)
            ) : (
              hasLoaded && (
                <div className={commentsTabStyles.empty} role="status">
                  <span className={commentsTabStyles.emptyIcon} aria-hidden="true">
                    {filters.status === "resolved" ? (
                      <CheckOutlined />
                    ) : (
                      <MessageOutlined />
                    )}
                  </span>
                  <div className={commentsTabStyles.emptyTitle}>
                    {uiT(
                      filters.onlyRelated
                        ? "No comments related to you"
                        : emptyMessages[filters.status].title,
                    )}
                  </div>
                  <div className={commentsTabStyles.emptyHint}>
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
      </div>
    </section>
  );
});

export default CommentsTab;
