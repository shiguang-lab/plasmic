import { apiKey } from "@/wab/client/api";
import { menuSection } from "@/wab/client/components/menu-builder";
import {
  reactConfirm,
  reactPrompt,
} from "@/wab/client/components/quick-modals";
import { promptBranchVersion } from "@/wab/client/components/sidebar-tabs/ProjectPanel/BranchVersionDialog";
import { Matcher } from "@/wab/client/components/view-common";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx, useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { testIds } from "@/wab/client/test-ids";
import {
  ApiBranch,
  BranchId,
  ListBranchesResponse,
  MainBranchId,
} from "@/wab/shared/ApiSchema";
import { validateBranchName } from "@/wab/shared/ApiSchemaUtil";
import { assert, ensure, spawnWrapper } from "@/wab/shared/common";
import { APP_ROUTES, SEARCH_PARAM_BRANCH } from "@/wab/shared/route/app-routes";
import {
  BranchesOutlined,
  CheckOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Input,
  Menu,
  Spin,
  Tooltip,
  notification,
} from "antd";
import { createStyles } from "antd-style";
import { trimStart } from "lodash";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { useDebounce } from "react-use";
import useSWR, { mutate } from "swr";

const useStyles = createStyles(({ token }) => ({
  root: { width: "100%", minWidth: 0 },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  loading: { display: "flex", justifyContent: "center", padding: 32 },
  list: { maxHeight: "min(400px, 50vh)", overflowY: "auto", marginTop: 8 },
  section: { padding: 8, fontSize: 12, color: token.colorTextSecondary },
  row: { display: "flex", alignItems: "center", gap: 4 },
  branch: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
    height: 36,
    textAlign: "left",
    '&[aria-pressed="true"]': {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
    },
  },
  name: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));

export const BranchPanelTop = observer(React.forwardRef(BranchPanelTop_));

function BranchPanelTop_(
  { onClose }: { onClose: () => void },
  outerRef: React.Ref<HTMLDivElement>,
) {
  const { t, label } = useI18n();
  const { styles } = useStyles();
  const topFrameApi = useTopFrameApi();
  const studioCtx = useStudioCtx();
  const projectId = studioCtx.siteInfo.id;
  const api = studioCtx.appCtx.api;
  const {
    data: branchesResponse,
    error: branchesError,
    mutate: reloadBranches,
  } = useSWR<ListBranchesResponse>(
    apiKey(`listBranchesForProject`, projectId),
    () => api.listBranchesForProject(projectId),
    { revalidateOnMount: true, focusThrottleInterval: 0, dedupingInterval: 0 },
  );

  const [queryMatcher, setQueryMatcher] = useState(mkMatcher());
  const [query, setQuery] = useState("");
  const [fetchingData, setFetchingData] = useState(false);

  useDebounce(() => setQueryMatcher(mkMatcher(query)), 200, [query]);

  if (branchesError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t("Unable to load branches")}
        action={
          <Button
            onClick={() => {
              void reloadBranches();
            }}
          >
            {t("Retry")}
          </Button>
        }
      />
    );
  }
  if (!branchesResponse || fetchingData) {
    return (
      <div className={styles.loading} ref={outerRef}>
        <Spin />
      </div>
    );
  }

  // The `undefined` branch is the main branch, in both items and activeBranch (which are compared later).

  const allBranches = branchesResponse.branches;
  const focusedBranch = allBranches.find(
    (branch) => branch.id === studioCtx.dbCtx().branchInfo?.id,
  );
  const activeBranches = allBranches.filter(
    (branch) => branch.status === "active",
  );
  const archivedBranches = allBranches.filter(
    (branch) => branch.status === "abandoned" || branch.status === "merged",
  );

  function queryBranches(branches: (ApiBranch | undefined)[]) {
    return branches
      .filter((branch) => queryMatcher.matches(branch?.name ?? "main"))
      .map((branch) => ({
        type: "branch",
        branch,
        nameWithQueryHighlighting: queryMatcher.boldSnippets(
          branch?.name ?? "main",
        ),
      }));
  }

  const shownActiveBranches = queryBranches([undefined, ...activeBranches]);
  const shownArchivedBranches = queryBranches(archivedBranches);
  async function promptBranchName(defaultValue: string) {
    const name = await reactPrompt({
      message: t("Branch name"),
      actionText: t(defaultValue ? "Rename" : "Create new branch"),
      placeholder: "feat/branchname",
      defaultValue,
      rules: [
        {
          async validator(_, value) {
            const msg = validateBranchName(
              value,
              allBranches.filter((b) => b.name !== defaultValue),
            );
            if (msg) {
              throw new Error(label(msg));
            }
          },
        },
      ],
    });
    return name;
  }

  function refresh() {
    return mutate(apiKey("listBranchesForProject", projectId));
  }

  async function onRename(branch: ApiBranch) {
    const name = await promptBranchName(branch.name);
    if (!name) {
      return;
    }
    await api.updateBranch(projectId, branch.id, { name });
    await refresh();
    // Refresh the branch and repalce the URL if we're renaming the currently focused branch
    if (focusedBranch?.id === branch.id) {
      const branches = await api.listBranchesForProject(projectId);
      const updatedBranch = branches.branches.find((b) => b.id === branch.id);
      studioCtx.switchToBranch(updatedBranch, undefined, { replace: true });
    }
  }

  async function checkMainCommitted() {
    const hasCommits = studioCtx.releases.length > 0;
    if (
      !hasCommits ||
      (await studioCtx.branchHasUnpublishedChanges({ branchId: null }))
    ) {
      const choice = await promptBranchVersion(hasCommits);
      if (choice === "save") {
        if (studioCtx.dbCtx().branchInfo) {
          await studioCtx.switchToBranch(undefined);
        }
        await topFrameApi.setShowPublishModal(true);
        return false;
      }
      return choice === "use-last";
    }
    assert(
      hasCommits,
      "Must have some commits at this point in creating a branch",
    );
    return true;
  }

  async function checkUnpublishedChanges(sourceBranchId: BranchId) {
    setFetchingData(true);
    const hasUnpublishedChanges = await studioCtx.branchHasUnpublishedChanges({
      branchId: sourceBranchId,
    });
    setFetchingData(false);
    if (hasUnpublishedChanges) {
      const choice = await promptBranchVersion(true);
      if (choice === "save") {
        if (sourceBranchId !== studioCtx.branchInfo()?.id) {
          await studioCtx.switchToBranch(
            ensure(
              allBranches.find((branch) => branch.id === sourceBranchId),
              () => `Couldn't find branch ${sourceBranchId}`,
            ),
          );
        }
        await topFrameApi.setShowPublishModal(true);
        return false;
      }
      return choice === "use-last";
    }
    return true;
  }

  async function handleCreateBranch(sourceBranchId?: BranchId) {
    onClose();
    if (studioCtx.appCtx.appConfig.disableBranching) {
      return notification.error({
        message: t("Branch creation in maintenance"),
        duration: 0,
        description: (
          <>
            <p>
              <UiText message="We are debugging some issues with the branching functionality that's in early access, and out of an abundance of caution, we're disabling creation of new branches at the moment. We are taking the feature into maintenance to iron things out, and currently estimate it will take several weeks before we are comfortable re-enabling the functionality." />
            </p>
            <p>
              <UiText message="If necessary, you can continue accessing and merging the branches you currently have open, but we generally recommend avoiding unnecessary merges if possible." />
            </p>
            <p>
              <UiText message="Sorry for the inconvenience - we know branching is an important part of the workflow, and we wouldn't disrupt things unless we felt it was needed to guarantee reliability. We're working on it. Thank you for bearing with us!" />
            </p>
          </>
        ),
      });
    }

    // If we're cloning the main branch but the main branch was never committed....
    if (!sourceBranchId && !(await checkMainCommitted())) {
      return undefined;
    }

    if (sourceBranchId && !(await checkUnpublishedChanges(sourceBranchId))) {
      return undefined;
    }

    const name = await promptBranchName("");
    if (!name) {
      return undefined;
    }
    let newBranch: ApiBranch;
    try {
      ({ branch: newBranch } = await api.createBranch(projectId, {
        name,
        sourceBranchId: sourceBranchId,
      }));
    } catch (e) {
      if (e.name === "ForbiddenError") {
        showBranchPermissionError("create");
        return undefined;
      }
      throw e;
    }
    await refresh();
    await studioCtx.switchToBranch(newBranch);
    return newBranch;
  }

  const canManage = studioCtx.canEditProject() && !studioCtx.isLiveMode;
  const renderBranch = ({
    branch,
    nameWithQueryHighlighting,
  }: ReturnType<typeof queryBranches>[number]) => {
    const selected = branch?.id === focusedBranch?.id;
    const onSwitch = async () => {
      if (!selected) {
        if (
          studioCtx.isLiveMode &&
          APP_ROUTES.projectPreview.parse(
            studioCtx.appCtx.history.location.pathname,
          )
        ) {
          const hashParams = new URLSearchParams(
            trimStart(studioCtx.appCtx.history.location.hash, "#"),
          );
          hashParams.set(SEARCH_PARAM_BRANCH, branch?.name || MainBranchId);
          studioCtx.appCtx.history.push({ hash: `#${hashParams.toString()}` });
        } else {
          await studioCtx.switchToBranch(branch);
        }
      }
      onClose();
    };
    return (
      <div key={branch?.id ?? MainBranchId} className={styles.row}>
        <Button
          type="text"
          className={styles.branch}
          aria-pressed={selected}
          aria-label={branch?.name ?? "main"}
          title={branch?.name ?? "main"}
          onClick={spawnWrapper(onSwitch)}
        >
          <BranchesOutlined />
          <span className={styles.name}>{nameWithQueryHighlighting}</span>
          {selected && <CheckOutlined />}
        </Button>
        {canManage && (
          <Dropdown
            trigger={["click"]}
            popupRender={getBranchMenuRenderer({
              t,
              branch,
              studioCtx,
              onClose,
              onSwitch,
              onRename: async () => {
                if (branch) {
                  await onRename(branch);
                }
              },
              onDuplicate: async () => {
                await handleCreateBranch(branch?.id);
              },
              onToggleProtectionMainBranch: async () => {
                await api.setMainBranchProtection(
                  projectId,
                  !studioCtx.siteInfo.isMainBranchProtected,
                );
                await studioCtx.refreshSiteInfo();
                studioCtx.handleBranchProtectionAlert();
              },
            })}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              aria-label={`${t("Branch actions")}: ${branch?.name ?? "main"}`}
            />
          </Dropdown>
        )}
      </div>
    );
  };
  return (
    <div className={styles.root} ref={outerRef} {...testIds.projectPanel}>
      <div className={styles.header}>
        <strong>{t("Branches")}</strong>
        {canManage && (
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={spawnWrapper(async () => {
              await handleCreateBranch();
            })}
          >
            {t("Create new branch")}
          </Button>
        )}
      </div>
      <Input
        autoFocus
        allowClear
        prefix={<SearchOutlined />}
        placeholder={t("Search branches")}
        aria-label={t("Search branches")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.list}>
        {shownActiveBranches.length > 0 && (
          <>
            <div className={styles.section}>{t("Active Branches")}</div>
            {shownActiveBranches.map(renderBranch)}
          </>
        )}
        {shownArchivedBranches.length > 0 && (
          <>
            <div className={styles.section}>{t("Archived Branches")}</div>
            {shownArchivedBranches.map(renderBranch)}
          </>
        )}
        {!shownActiveBranches.length && !shownArchivedBranches.length && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("No branches found")}
          />
        )}
      </div>
    </div>
  );
}

function getBranchMenuRenderer({
  t,
  branch: _branch,
  studioCtx,
  onRename,
  onSwitch,
  onDuplicate,
  onToggleProtectionMainBranch,
}: {
  t: ReturnType<typeof useI18n>["t"];
  branch: ApiBranch | undefined;
  onClose: () => void;
  onRename: () => Promise<void>;
  onSwitch: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onToggleProtectionMainBranch: () => Promise<void>;
  studioCtx: StudioCtx;
}) {
  return () => {
    const branch = _branch;
    const projectId = studioCtx.siteInfo.id;
    const isMainBranchProtected = studioCtx.siteInfo.isMainBranchProtected;
    const api = studioCtx.appCtx.api;

    function refresh() {
      return mutate(apiKey("listBranchesForProject", projectId));
    }

    return (
      <Menu
        onClick={(e) => {
          e.domEvent.stopPropagation();
        }}
        id="proj-item-menu"
      >
        {menuSection(
          "branch-protect",
          !branch && (
            <Menu.Item
              key="protect"
              onClick={async () => {
                await onToggleProtectionMainBranch();
              }}
            >
              <Tooltip
                title={
                  <UiText
                    message={
                      "When the main branch is in a protected state it's not possible to do direct changes to it."
                    }
                  />
                }
              >
                <UiText
                  message={"{part1} main branch"}
                  values={{
                    part1: (
                      <strong>
                        <UiText
                          message={
                            isMainBranchProtected ? "Unprotect" : "Protect"
                          }
                        />
                      </strong>
                    ),
                  }}
                />
              </Tooltip>
            </Menu.Item>
          ),
        )}
        {menuSection(
          "branch-switch",
          <Menu.Item key="switch" onClick={onSwitch}>
            <UiText
              message="{part1} to branch"
              values={{
                part1: (
                  <strong>
                    <UiText message={"Switch"} />
                  </strong>
                ),
              }}
            />
          </Menu.Item>,
        )}
        {menuSection(
          "branch-name",
          branch && (
            <Menu.Item
              key="rename"
              onClick={async (e) => {
                e.domEvent.stopPropagation();
                await onRename();
              }}
            >
              <strong>
                <UiText message={"Rename"} />
              </strong>{" "}
              <UiText message={"branch"} />
            </Menu.Item>
          ),
          <Menu.Item key="duplicate" onClick={onDuplicate}>
            <strong>
              <UiText message={"Duplicate"} />
            </strong>{" "}
            <UiText message={"branch"} />
          </Menu.Item>,
        )}
        {branch &&
          menuSection(
            "branch-state",
            <Menu.Item
              key="archive"
              onClick={async () => {
                await api.updateBranch(projectId, branch.id, {
                  status: branch.status === "active" ? "abandoned" : "active",
                });
                await refresh();
              }}
            >
              <strong>
                <UiText
                  message={branch.status === "active" ? "Archive" : "Unarchive"}
                />
              </strong>{" "}
              <UiText message={"branch"} />
            </Menu.Item>,
            <Menu.Item
              key="delete"
              onClick={async () => {
                if (
                  await reactConfirm({
                    title: t("Delete branch"),
                    message: (
                      <>
                        <p>
                          <UiText
                            message="Are you sure you want to delete the branch {part1}?"
                            values={{ part1: <strong>{branch.name}</strong> }}
                          />
                        </p>
                        <p>
                          <UiText message={"This action cannot be undone."} />
                        </p>
                      </>
                    ),
                    confirmLabel: t("Delete"),
                    cancelLabel: t("Cancel"),
                  })
                ) {
                  if (studioCtx.dbCtx().branchInfo?.id === branch.id) {
                    // Switch to main branch if this was the focused branch
                    await studioCtx.switchToBranch(undefined);
                  }
                  try {
                    await api.deleteBranch(projectId, branch.id);
                  } catch (e) {
                    if (e.name === "ForbiddenError") {
                      showBranchPermissionError("delete");
                      return;
                    }
                    throw e;
                  }
                  await refresh();
                }
              }}
            >
              <strong>
                <UiText message={"Delete"} />
              </strong>{" "}
              <UiText message={"branch"} />
            </Menu.Item>,
          )}
      </Menu>
    );
  };
}

function showBranchPermissionError(action: "create" | "delete") {
  notification.error({
    message: <UiText message="Permission denied" />,
    description: (
      <UiText message={action === "create"
        ? "You do not have permission to create branches in this project."
        : "You do not have permission to delete branches in this project."} />
    ),
  });
}

function mkMatcher(q: string = "") {
  return new Matcher(q, { matchMiddleOfWord: true });
}
