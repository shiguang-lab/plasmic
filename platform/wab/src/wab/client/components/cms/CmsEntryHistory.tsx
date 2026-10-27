import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { showError } from "@/wab/client/ErrorNotifications";
import { useUsersMap } from "@/wab/client/api-hooks";
import { renderContentEntryFormFields } from "@/wab/client/components/cms/CmsEntryDetails";
import {
  useCmsDatabase,
  useCmsRow,
  useCmsRowHistory,
  useCmsRowRevision,
  useCmsTable,
  useMutateRow,
} from "@/wab/client/components/cms/cms-contexts";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import {
  FormSkeleton,
  RowsSkeleton,
} from "@/wab/client/components/widgets/ContentSkeletons";
import { useApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { Redirect } from "@/wab/client/route/Redirect";
import { Switch, switchCase, switchDefault } from "@/wab/client/route/Switch";
import { useMatchedRoute } from "@/wab/client/route/useMatchedRoute";
import { CmsDatabaseId, CmsRowId, CmsTableId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { formatDateMediumTimeShort } from "@/wab/shared/utils/date-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Empty, Flex, Form, Tag, Typography, message } from "antd";
import { createStyles } from "antd-style";
import React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 280px) minmax(0, 1fr)",
    height: "100%",
    minHeight: 0,
    gap: 24,
    "@media (max-width: 700px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(120px, 200px) minmax(0, 1fr)",
    },
  },
  list: {
    minHeight: 0,
    minWidth: 0,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
    paddingRight: 16,
  },
  revision: {
    width: "100%",
    height: "auto",
    textAlign: "left",
    justifyContent: "flex-start",
    whiteSpace: "normal",
    padding: 12,
    marginBottom: 8,
  },
  content: { minHeight: 0, minWidth: 0, padding: 4 },
  state: { padding: 24, color: token.colorText },
}));

export function CmsEntryHistory(props: {
  databaseId: CmsDatabaseId;
  tableId: CmsTableId;
  rowId: CmsRowId;
}) {
  const { databaseId, tableId, rowId } = props;
  const { revisions, error, mutate } = useCmsRowHistory(rowId);
  useErrorMessage(error, "Failed to load revision history");
  const { data: userById } = useUsersMap(
    (revisions ?? []).map((rev) => rev.createdById),
  );
  const { t } = useI18n();
  const { styles } = useStyles();
  if (!revisions) {
    return (
      <div className={styles.state}>
        {error ? (
          <Button
            onClick={() => {
              void mutate();
            }}
          >
            {t("Retry")}
          </Button>
        ) : (
          <div role="status" aria-label={t("Loading revision history…")}>
            <RowsSkeleton rows={5} />
          </div>
        )}
      </div>
    );
  }
  if (revisions.length === 0) {
    return <Empty description={t("No revision history")} />;
  }
  return (
    <div className={styles.root}>
      <Scrollbar
        role="navigation"
        scrollX={false}
        className={styles.list}
        aria-label={t("Entry revisions")}
      >
        <Switch
          cases={[
            switchCase({
              route: APP_ROUTES.cmsEntryRevision,
              render: ({ revisionId }) => (
                <>
                  {revisions.map((revision) => (
                    <Button
                      className={styles.revision}
                      type={revisionId === revision.id ? "primary" : "text"}
                      aria-current={
                        revisionId === revision.id ? "page" : undefined
                      }
                      href={APP_ROUTES.cmsEntryRevision.fill({
                        revisionId: revision.id,
                        tableId,
                        rowId,
                        databaseId,
                      })}
                      key={revision.id}
                    >
                      <Flex vertical gap={4}>
                        <span>
                          {formatDateMediumTimeShort(
                            new Date(revision.createdAt),
                          )}
                        </span>
                        <Flex gap={4} wrap align="center">
                          <Tag
                            color={revision.isPublished ? "success" : "default"}
                          >
                            {t(revision.isPublished ? "Published" : "Autosave")}
                          </Tag>
                          {revision.createdById &&
                            userById?.[revision.createdById] && (
                              <span>
                                {t("by")}{" "}
                                {userById[revision.createdById].displayName}
                              </span>
                            )}
                        </Flex>
                      </Flex>
                    </Button>
                  ))}
                </>
              ),
            }),
            switchCase({
              route: APP_ROUTES.cmsEntryRevisions,
              render: () => (
                <Redirect
                  to={APP_ROUTES.cmsEntryRevision.fill({
                    ...props,
                    revisionId: revisions[0].id,
                  })}
                />
              ),
            }),
            switchDefault({ render: () => null }),
          ]}
        />
      </Scrollbar>
      <Switch
        cases={[
          switchCase({
            exact: true,
            route: APP_ROUTES.cmsEntryRevision,
            render: ({ revisionId }) => <EntryRevisionView key={revisionId} />,
          }),
          switchDefault({ render: () => null }),
        ]}
      />
    </div>
  );
}

export function EntryRevisionView() {
  const { databaseId, tableId, rowId, revisionId } = useMatchedRoute(
    APP_ROUTES.cmsEntryRevision,
  )!.pathParams;
  const {
    database,
    error: databaseError,
    mutate: retryDatabase,
  } = useCmsDatabase(databaseId);
  const table = useCmsTable(databaseId, tableId);
  const {
    row: currentRow,
    error: rowError,
    mutate: retryRow,
  } = useCmsRow(tableId, rowId);
  const {
    revision,
    error: revisionError,
    mutate: retryRevision,
  } = useCmsRowRevision(rowId, revisionId);
  const api = useApi();
  const mutateRow = useMutateRow();
  const history = useHistory();
  const { t } = useI18n();
  const { styles } = useStyles();
  const [restoring, setRestoring] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState(false);
  const restorePending = React.useRef(false);
  useErrorMessage(databaseError || rowError || revisionError, "Failed to load revision");

  const finishRestore = async () => {
    await mutateRow(tableId, rowId);
    history.push(APP_ROUTES.cmsEntry.fill({ databaseId, tableId, rowId }));
  };
  if (!revision || !database || !table || !currentRow) {
    return (
      <div className={styles.state}>
        {databaseError || rowError || revisionError ? (
          <Button
            onClick={() => {
              void Promise.allSettled([
                retryDatabase(),
                retryRow(),
                retryRevision(),
              ]);
            }}
          >
            {t("Retry")}
          </Button>
        ) : (
          <div role="status" aria-label={t("Loading revision…")}>
            <FormSkeleton />
          </div>
        )}
      </div>
    );
  }
  return (
    <Scrollbar scrollX={false} className={styles.content}>
      <Flex vertical gap={16}>
        {refreshError && (
          <Button
            loading={restoring}
            onClick={async () => {
              setRestoring(true);
              try {
                await finishRestore();
              } catch (error) {
                showError(error, { title: "Revision restored, but refreshing failed" });
                setRefreshError(true);
              } finally {
                setRestoring(false);
              }
            }}
          >
            {t("Retry")}
          </Button>
        )}
        <Form layout="vertical" initialValues={revision.data}>
          <Flex
            justify="space-between"
            align="center"
            wrap
            gap={12}
            style={{ marginBottom: 24 }}
          >
            <Typography.Text type="secondary">
              {t("Revision content is read-only")}
            </Typography.Text>
            <Button
              type="primary"
              loading={restoring}
              disabled={refreshError}
              onClick={async () => {
                if (restorePending.current) {
                  return;
                }
                restorePending.current = true;
                try {
                  if (
                    !(await reactConfirm({
                      title: t("Overwrite current draft with this revision?"),
                      message: t(
                        "Any changes you've made to the current version will be overwritten.",
                      ),
                    }))
                  ) {
                    return;
                  }
                  setRestoring(true);
                  try {
                    await api.updateCmsRow(rowId, {
                      draftData: revision.data,
                      revision: currentRow.revision,
                      noMerge: true,
                    });
                  } catch (error) {
                    showError(error, { title: "Failed to restore revision" });
                    return;
                  }
                  void message.success(t("Revision restored!"));
                  try {
                    await finishRestore();
                  } catch (error) {
                    showError(error, { title: "Revision restored, but refreshing failed" });
                    setRefreshError(true);
                  }
                } finally {
                  setRestoring(false);
                  restorePending.current = false;
                }
              }}
            >
              {t("Restore")}
            </Button>
          </Flex>
          {renderContentEntryFormFields(
            table,
            database,
            database.extraData.locales,
            true,
          )}
        </Form>
      </Flex>
    </Scrollbar>
  );
}
