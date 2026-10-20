import { reportError } from "@/wab/client/ErrorNotifications";
import { HostConfig } from "@/wab/client/components/HostConfig";
import { promptMoveToWorkspace } from "@/wab/client/components/dashboard/dashboard-actions";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { ProjectPreview } from "@/wab/client/components/dashboard/preview/ProjectPreview";
import { maybeShowPaywall } from "@/wab/client/components/modals/PricingModal";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import { Matcher } from "@/wab/client/components/view-common";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { ApiPermission, ApiProject, WorkspaceId } from "@/wab/shared/ApiSchema";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { cx, ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import {
  getAccessLevelToParent,
  getAccessLevelToResource,
} from "@/wab/shared/perms";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { EditOutlined, FileOutlined, MoreOutlined } from "@ant-design/icons";
import { Dropdown, Input, Menu, message } from "antd";
import React from "react";

interface ProjectListItemProps {
  // className prop is required for positioning instances of
  // this Component
  className?: string;
  project: ApiProject;
  perms: ApiPermission[];
  onUpdate?: () => Promise<void>;
  workspaces?: boolean;
  matcher?: Matcher;
  showWorkspace?: boolean;
}

function ProjectTitle({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const container = React.useRef<HTMLSpanElement>(null);
  const text = React.useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = React.useState(0);
  React.useLayoutEffect(() => {
    const measure = () =>
      setOverflow(
        Math.max(
          0,
          (text.current?.scrollWidth ?? 0) -
            (container.current?.clientWidth ?? 0),
        ),
      );
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) {
      observer.observe(container.current);
    }
    if (text.current) {
      observer.observe(text.current);
    }
    return () => observer.disconnect();
  }, [name, children]);
  return (
    <span
      ref={container}
      className={cx(styles.title, overflow > 0 && styles.overflowingTitle)}
      title={name}
      style={
        {
          "--title-travel": `${-overflow}px`,
          "--title-duration": `${Math.max(3, overflow / 30 + 2)}s`,
        } as React.CSSProperties
      }
    >
      <span ref={text}>{children}</span>
    </span>
  );
}

function ProjectListItem(props: ProjectListItemProps) {
  const { project, perms, onUpdate, workspaces, matcher, showWorkspace } =
    props;
  const { t, locale } = useI18n();
  const appCtx = useAppCtx();
  const history = useHistory();
  const appOps = ensure(appCtx.ops, "Unexpected nullish AppOps");
  const [configProjectId, setConfigProjectId] = React.useState<string>();
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(project.name);
  const [submitting, setSubmitting] = React.useState(false);
  const editingSession = React.useRef(false);
  const saving = React.useRef(false);
  const finishEditing = () => {
    editingSession.current = false;
    setEditing(false);
  };
  const saveName = async () => {
    if (!editingSession.current || saving.current) {
      return;
    }
    const name = draftName.trim();
    if (!name || name === project.name) {
      finishEditing();
      return;
    }
    saving.current = true;
    setSubmitting(true);
    try {
      await appOps.renameSite(project.id, name);
      project.name = name;
      finishEditing();
      await onUpdate?.();
    } catch (error) {
      reportError(error as Error);
    } finally {
      saving.current = false;
      setSubmitting(false);
    }
  };

  const projectAccessLevel = getAccessLevelToResource(
    { type: "project", resource: project },
    appCtx.selfInfo,
    perms,
  );

  const workspaceAccessLevel = getAccessLevelToParent(
    { type: "project", resource: project },
    appCtx.selfInfo,
    perms,
  );

  const canMove = project.workspaceId
    ? accessLevelRank(workspaceAccessLevel) >= accessLevelRank("editor")
    : accessLevelRank(projectAccessLevel) >= accessLevelRank("editor");

  const personalWorkspace = React.useMemo(
    () => appCtx.personalWorkspace,
    [appCtx.workspaces],
  );

  const duplicateProject = async () => {
    const response = await promptMoveToWorkspace(
      appCtx,
      null,
      false,
      "Duplicate",
      project.name,
    );
    if (response === undefined) {
      return;
    }

    const { projectId: newProjectId } = await appCtx.app.withSpinner(
      appCtx.api.cloneProject(
        project.id,
        response.result === "workspace"
          ? {
              workspaceId: response.workspace.id,
              name: response.name,
            }
          : undefined,
      ),
    );

    history.push(
      APP_ROUTES.project.fill({
        projectId: newProjectId,
      }),
    );
  };

  const openProject = () =>
    history.push(APP_ROUTES.project.fill({ projectId: project.id }));
  return (
    <>
      <div
        className={cx(styles.projectCard, props.className)}
        role="link"
        tabIndex={0}
        aria-label={t("Open project") + ": " + project.name}
        onClick={editing ? undefined : openProject}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && event.key === "Enter") {
            event.preventDefault();
            openProject();
          }
        }}
      >
        <div className={styles.thumbnail} aria-hidden>
          {DEVFLAGS.dashboardCanvasPreview && appCtx.selfInfo?.id ? (
            <ProjectPreview
              userId={appCtx.selfInfo.id}
              projectId={project.id}
              updatedAt={new Date(project.updatedAt).toISOString()}
            />
          ) : (
            <>
              <FileOutlined />
              <ProjectTitle name={project.name}>{project.name}</ProjectTitle>
            </>
          )}
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.nameRow}>
              {editing ? (
                <Input
                  className={styles.nameInput}
                  aria-label={t("Rename project")}
                  autoFocus
                  onFocus={(event) => event.target.select()}
                  value={draftName}
                  disabled={submitting}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setDraftName(event.target.value)}
                  onPressEnter={() => void saveName()}
                  onBlur={() => void saveName()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      finishEditing();
                    }
                  }}
                />
              ) : (
                <ProjectTitle name={project.name}>
                  {matcher?.boldSnippets(project.name, "yellow-snippet") ||
                    project.name}
                </ProjectTitle>
              )}
              {!editing &&
                accessLevelRank(projectAccessLevel) >=
                  accessLevelRank("content") && (
                  <button
                    type="button"
                    className={cx(styles.menuButton, styles.editButton)}
                    aria-label={t("Rename project")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDraftName(project.name);
                      editingSession.current = true;
                      setEditing(true);
                    }}
                  >
                    <EditOutlined />
                  </button>
                )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                popupRender={() => (
                  <Menu>
                    {accessLevelRank(projectAccessLevel) >=
                      accessLevelRank("editor") && (
                      <Menu.Item onClick={() => setConfigProjectId(project.id)}>
                        {t("Configure project")}
                      </Menu.Item>
                    )}
                    <Menu.Item onClick={duplicateProject}>
                      {t("Duplicate project")}
                    </Menu.Item>
                    {DEVFLAGS.demo && (
                      <Menu.Item onClick={() => appOps.download(project.id)}>
                        {t("Download project")}
                      </Menu.Item>
                    )}
                    {workspaces && canMove && (
                      <Menu.Item
                        onClick={async () => {
                          const response = await promptMoveToWorkspace(
                            appCtx,
                            project.workspaceId,
                            false,
                            "Move",
                          );
                          if (response === undefined) {
                            return;
                          }
                          await maybeShowPaywall(
                            appCtx,
                            async () =>
                              await appCtx.api.setSiteInfo(project.id, {
                                workspaceId:
                                  response.result === "workspace"
                                    ? response.workspace.id
                                    : null,
                              }),
                            {
                              title: t("Upgrade to move this project"),
                              description: t(
                                "The destination workspace belongs to a team that does not have enough seats. Increase the number of seats to perform this action.",
                              ),
                            },
                          );
                          void message.success({
                            content: t("Project moved to {name}.", {
                              name:
                                response.result === "workspace"
                                  ? response.workspace.name
                                  : t("My Playground"),
                            }),
                          });
                          await onUpdate?.();
                        }}
                      >
                        {t("Move to workspace")}
                      </Menu.Item>
                    )}
                    {accessLevelRank(workspaceAccessLevel) >=
                      accessLevelRank("editor") && (
                      <Menu.Item
                        onClick={async () => {
                          await appCtx.api.setSiteInfo(project.id, {
                            isUserStarter: !project.isUserStarter,
                          });
                          void message.success({
                            content: t(
                              project.isUserStarter
                                ? 'Project "{name}" removed as workspace starter.'
                                : 'Project "{name}" set as workspace starter.',
                              { name: project.name },
                            ),
                          });

                          await onUpdate?.();
                        }}
                      >
                        {t(
                          !project.isUserStarter
                            ? "Set as workspace starter"
                            : "Unset as workspace starter",
                        )}
                      </Menu.Item>
                    )}
                    {!(
                      accessLevelRank(workspaceAccessLevel) >=
                      accessLevelRank("viewer")
                    ) &&
                      accessLevelRank(projectAccessLevel) <
                        accessLevelRank("owner") && (
                        <Menu.Item
                          onClick={async () => {
                            const confirm = await reactConfirm({
                              title: t("Remove from dashboard"),
                              message: (
                                <>
                                  {t(
                                    'Remove project "{name}" from your dashboard? This removes your current permissions.',
                                    { name: project.name },
                                  )}
                                </>
                              ),
                            });
                            if (!confirm) {
                              return;
                            }
                            await appCtx.api.removeSelfPerm(project.id);
                            await onUpdate?.();
                          }}
                        >
                          {t("Remove from dashboard")}
                        </Menu.Item>
                      )}
                    {accessLevelRank(projectAccessLevel) >=
                      accessLevelRank("owner") && (
                      <Menu.Item
                        onClick={async () => {
                          const confirm = await reactConfirm({
                            title: t("Delete project"),
                            message: (
                              <>
                                {t('Delete project "{name}"?', {
                                  name: project.name,
                                })}
                              </>
                            ),
                          });
                          if (!confirm) {
                            return;
                          }
                          await appOps.deleteSite(project.id);
                          await onUpdate?.();
                        }}
                      >
                        {t("Delete project")}
                      </Menu.Item>
                    )}
                  </Menu>
                )}
                trigger={["click"]}
                placement="bottomRight"
              >
                <button
                  type="button"
                  aria-label={t("More")}
                  className={styles.menuButton}
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreOutlined />
                </button>
              </Dropdown>
            </div>
          </div>
          <div className={styles.meta}>
            <span>
              {t("Updated {date}", {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(project.updatedAt)),
              })}
            </span>
            {accessLevelRank(workspaceAccessLevel) >=
              accessLevelRank("viewer") &&
              showWorkspace &&
              project.workspaceName && (
                <span
                  className={styles.workspace}
                  onClick={(e) => {
                    e.stopPropagation();
                    history.push(
                      project.workspaceId === personalWorkspace?.id
                        ? APP_ROUTES.playground.fill({})
                        : APP_ROUTES.workspace.fill({
                            workspaceId:
                              project.workspaceId || ("" as WorkspaceId),
                          }),
                    );
                  }}
                >
                  {project.workspaceId === personalWorkspace?.id
                    ? t("My Playground")
                    : matcher?.boldSnippets(
                        project.workspaceName || "",
                        "yellow-snippet",
                      ) || project.workspaceName}
                </span>
              )}
          </div>
        </div>
      </div>
      {configProjectId && (
        <HostConfig
          appCtx={appCtx}
          project={project}
          onCancel={() => {
            setConfigProjectId(undefined);
          }}
          onUpdate={() => Promise.resolve(void onUpdate?.())}
        />
      )}
    </>
  );
}

export default ProjectListItem as React.FunctionComponent<ProjectListItemProps>;
