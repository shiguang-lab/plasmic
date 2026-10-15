import { showError } from "@/wab/client/ErrorNotifications";
import { ProjectDependencyData } from "@/wab/client/ProjectDependencyManager";
import { openNewTab } from "@/wab/client/cli-routes";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { promptImportProject } from "@/wab/client/components/modals/ImportProjectModal";
import {
  promptDeleteDep,
  promptUpgradeDep,
  promptUpgradeDeps,
} from "@/wab/client/components/modals/UpgradeDepModal";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import { shouldShowHostLessPackage } from "@/wab/client/components/studio/add-drawer/AddDrawer";
import { useLibraryPanelStyles } from "@/wab/client/components/ui/layout-styles";
import { Matcher } from "@/wab/client/components/view-common";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { VERT_MENU_ICON } from "@/wab/client/icons";
import SearchIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SearchSvg";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { areEquivalentScreenVariants } from "@/wab/shared/Variants";
import { spawn } from "@/wab/shared/common";
import { getLeafProjectIdForHostLessPackageMeta } from "@/wab/shared/core/project-deps";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import { unbundleProjectDependency } from "@/wab/shared/core/tagged-unbundle";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { extractProjectIdFromUrlOrId, getPublicUrl } from "@/wab/shared/urls";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Avatar,
  Button,
  Empty,
  Input,
  Menu,
  Tag,
  Tooltip,
  notification,
} from "antd";
import { observer } from "mobx-react";
import React from "react";

function isDevUser(studioCtx: StudioCtx) {
  return (
    getPublicUrl().startsWith("http://localhost:3003") &&
    isAdminTeamEmail(
      studioCtx.appCtx.selfInfo?.email,
      studioCtx.appCtx.appConfig,
    )
  );
}

function dependencyDisplayName(
  studioCtx: StudioCtx,
  dependency: ProjectDependency,
) {
  if (!isHostLessPackage(dependency.site)) {
    return dependency.name;
  }
  const catalog =
    studioCtx.appCtx.appConfig.hostLessComponents ??
    DEVFLAGS.hostLessComponents ??
    [];
  return (
    catalog.find(
      (meta) =>
        getLeafProjectIdForHostLessPackageMeta(meta) === dependency.projectId &&
        meta.onlyShownIn !== "old" &&
        shouldShowHostLessPackage(studioCtx, meta),
    )?.name ?? dependency.name
  );
}

const DependencyItem = observer(function DependencyItem(props: {
  studioCtx: StudioCtx;
  matcher: Matcher;
  data: ProjectDependencyData;
  readOnly?: boolean;
}) {
  const { studioCtx, matcher, data, readOnly } = props;
  const { t } = useI18n();
  const isHostLessPkg = isHostLessPackage(data.model.site);
  const displayName = dependencyDisplayName(studioCtx, data.model);

  const renderMenu = () => {
    const builder = new MenuBuilder();
    builder.genSection(undefined, (push) => {
      const targetProjectId = data.latestPkgVersionMeta?.pkg?.projectId;
      if (!!targetProjectId && (!isHostLessPkg || isDevUser(studioCtx))) {
        push(
          <Menu.Item
            key="jump-newtab"
            onClick={() => {
              openNewTab(
                APP_ROUTES.project.fill({
                  projectId: targetProjectId,
                }),
              );
            }}
          >
            <UiText message={"Open project in new tab"} />
          </Menu.Item>,
        );
      }

      if (!readOnly) {
        push(
          <Menu.Item
            key="delete"
            onClick={async () => {
              const hostLessDependents =
                studioCtx.projectDependencyManager.getHostLessPackageDependents(
                  data.model.pkgId,
                );

              if (hostLessDependents.length > 0) {
                notification.error({
                  message: translate(
                    getUiLocale(),
                    "Cannot remove package, the package is a dependency of the following packages: {part1}",
                    { part1: hostLessDependents.join(",") },
                  ),
                });
                return;
              }

              const answer = await promptDeleteDep({
                studioCtx: studioCtx,
                curDep: data.model,
              });

              if (answer) {
                await studioCtx.projectDependencyManager.removeByPkgId(
                  data.model.pkgId,
                );
              }
            }}
          >
            <UiText message={"Remove imported project"} />
          </Menu.Item>,
        );
      }
    });
    return builder.build({
      onMenuClick: (e) => e.domEvent.stopPropagation(),
      menuName: "project-dep-item-menu",
    });
  };

  return (
    <WithContextMenu
      overlay={renderMenu}
      key={data.model.pkgId}
      className="project-library-row"
    >
      <Avatar className="project-library-avatar" shape="square" aria-hidden>
        {displayName.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className="project-library-info">
        <Tooltip title={data.model.name}>
          <div className="project-library-name">
            {matcher.boldSnippets(displayName)}
          </div>
        </Tooltip>
        <div className="project-library-meta">
          <span>{t(isHostLessPkg ? "Code library" : "Shared project")}</span>
          {data.model.version && <span>{`v${data.model.version}`}</span>}
        </div>
        {(!isHostLessPkg || isDevUser(studioCtx)) &&
          !readOnly &&
          data.latestPkgVersionMeta &&
          data.latestPkgVersionMeta.version !== data.model.version && (
            <div className="project-library-update">
              <Button
                type="link"
                size="small"
                onClick={async () => {
                  const { pkg: latest, depPkgs } =
                    await studioCtx.appCtx.api.getPkgVersion(
                      data.model.pkgId,
                      data.latestPkgVersionMeta?.version,
                    );

                  const { projectDependency } = unbundleProjectDependency(
                    studioCtx.bundler(),
                    latest,
                    depPkgs,
                  );

                  const answer = await promptUpgradeDep({
                    studioCtx: studioCtx,
                    targetDep: projectDependency,
                  });

                  if (answer) {
                    await studioCtx.projectDependencyManager.upgradeProjectDeps(
                      [projectDependency],
                    );
                  }
                }}
              >
                {t("View update")}
              </Button>
              <Tag color="gold">{t("New version available")}</Tag>
            </div>
          )}
      </div>
      {(!readOnly ||
        ((!isHostLessPkg || isDevUser(studioCtx)) &&
          data.latestPkgVersionMeta?.pkg?.projectId)) && (
        <IFrameAwareDropdownMenu menu={renderMenu}>
          <button
            type="button"
            className="project-library-menu"
            aria-label={t("Manage {name}", { name: displayName })}
          >
            {VERT_MENU_ICON}
          </button>
        </IFrameAwareDropdownMenu>
      )}
    </WithContextMenu>
  );
});

export async function importProjectWithPrompt(sc: StudioCtx) {
  const rawProjectUrlOrId = await promptImportProject();

  if (!rawProjectUrlOrId) {
    return;
  }
  const projectId = extractProjectIdFromUrlOrId(rawProjectUrlOrId);
  try {
    const dependency =
      await sc.projectDependencyManager.addByProjectId(projectId);
    if (dependency.site.activeScreenVariantGroup?.variants.length) {
      // Offer to switch screen variant if exists
      await trySwitchScreenVariant(sc, dependency);
    }
  } catch (e) {
    showError(e, {
      title: translate(getUiLocale(), "Error importing project."),
    });
  }
}

async function updateProjectsWithPrompt(
  studioCtx: StudioCtx,
  dependenciesWithUpdates: ProjectDependencyData[],
) {
  const targetDeps = await Promise.all(
    dependenciesWithUpdates.map(async (dep) => {
      const { pkg: latest, depPkgs } = await studioCtx.appCtx.api.getPkgVersion(
        dep.model.pkgId,
        dep.latestPkgVersionMeta?.version,
      );

      return unbundleProjectDependency(studioCtx.bundler(), latest, depPkgs)
        .projectDependency;
    }),
  );

  const shouldUpdate = await promptUpgradeDeps({ studioCtx, targetDeps });
  if (!shouldUpdate) {
    return;
  }
  await studioCtx.projectDependencyManager.upgradeProjectDeps(targetDeps);
}

async function trySwitchScreenVariant(
  studioCtx: StudioCtx,
  dependency: ProjectDependency,
) {
  const prevGroup = studioCtx.site.activeScreenVariantGroup;
  const newGroup = dependency.site.activeScreenVariantGroup;

  if (!newGroup) {
    return;
  }

  let switchGroup: boolean | undefined = true;

  if (prevGroup) {
    const missingVariants = prevGroup.variants.filter(
      (prevV) =>
        !newGroup.variants.find((newV) =>
          areEquivalentScreenVariants(prevV, newV),
        ),
    );

    switchGroup = await reactConfirm({
      message: (
        <div>
          <p>
            <UiText
              message={
                "Only one set of responsive breakpoints can be used in a project. This imported project also has responsive breakpoints associated; would you like to switch to them, so that the imported components can be responsive? We will preserve styles for your existing breakpoints that match up with imported breakpoints."
              }
            />
          </p>
          {missingVariants.length > 0 && (
            <p>
              <UiText
                message={
                  "But {part1} associated with breakpoints {part2}, because there are no imported breakpoints that match them exactly."
                }
                values={{
                  part1: (
                    <strong>
                      <UiText message={"you will lose changes"} />
                    </strong>
                  ),
                  part2:
                    " " + missingVariants.map((v) => `"${v.name}"`).join(", "),
                }}
              />
            </p>
          )}
        </div>
      ),
      confirmLabel: translate(
        getUiLocale(),
        'Switch to breakpoints from "{part1}"',
        { part1: dependency.name },
      ),
      cancelLabel: translate(
        getUiLocale(),
        "Keep using my existing breakpoints",
      ),
    });
  }

  if (switchGroup) {
    await studioCtx
      .siteOps()
      .updateActiveScreenVariantGroup(
        dependency.site.activeScreenVariantGroup!,
      );
  }
}

function _ProjectDependenciesPanel() {
  const sc = useStudioCtx();
  const { t } = useI18n();
  const { styles } = useLibraryPanelStyles();
  const [query, setQuery] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  const readOnly =
    sc.getLeftTabPermission("imports") !== "writable" ||
    sc.getLeftTabPermission("libraries") !== "writable" ||
    !sc.canSave();
  const matcher = new Matcher(query);

  // Function called when a user clicks the "+" icon
  // Create the list of dependencies
  const renderItems = () => {
    const items = sc.projectDependencyManager.getDependencies();
    const filteredItems = items.filter(
      (d) =>
        matcher.matches(d.model.name) ||
        matcher.matches(dependencyDisplayName(sc, d.model)),
    );

    return filteredItems.map((entry) => (
      <DependencyItem
        key={entry.model.pkgId}
        studioCtx={sc}
        matcher={matcher}
        data={entry}
        readOnly={readOnly}
      />
    ));
  };

  const dependenciesWithUpdates = sc.projectDependencyManager
    .getDependencies()
    .filter(
      (dep) =>
        dep.latestPkgVersionMeta &&
        dep.latestPkgVersionMeta.version !== dep.model.version &&
        (!isHostLessPackage(dep.model.site) || isDevUser(sc)),
    );

  const rendered = renderItems();
  return (
    <div className={`${styles.root} project-libraries`}>
      <div className="project-library-search">
        <Input
          prefix={<Icon icon={SearchIcon} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          autoFocus
          placeholder={t("Search project libraries")}
          aria-label={t("Search project libraries")}
        />
      </div>
      {!readOnly && (
        <div className="project-library-actions">
          <Button
            onClick={() => spawn(importProjectWithPrompt(sc))}
            data-test-id="import-btn"
          >
            {t("Import project")}
          </Button>
          <Button
            type="text"
            loading={refreshing}
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await sc.projectDependencyManager.refreshDeps();
              } catch (error) {
                showError(error, { title: t("Failed to check for updates") });
              } finally {
                setRefreshing(false);
              }
            }}
            data-test-id="check-for-updates-btn"
          >
            {t("Check for updates")}
          </Button>
        </div>
      )}
      <div className="project-library-summary">
        <span>{t("Added to current project")}</span>
        <span>
          {t("{count} libraries", {
            count: sc.projectDependencyManager.getDependencies().length,
          })}
        </span>
      </div>
      {!readOnly && dependenciesWithUpdates.length > 1 && (
        <Button
          className="project-library-update-all"
          onClick={() =>
            spawn(updateProjectsWithPrompt(sc, dependenciesWithUpdates))
          }
        >
          {t("Update all")}
        </Button>
      )}
      <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
        {rendered.length ? (
          rendered
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t(
              query ? "No matching libraries" : "No imported projects",
            )}
          />
        )}
      </Scrollbar>
    </div>
  );
}

export const ProjectDependenciesPanel = observer(_ProjectDependenciesPanel);
