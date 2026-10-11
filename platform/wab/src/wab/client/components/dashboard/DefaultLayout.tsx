import { PublicLink } from "@/wab/client/components/PublicLink";
import NavSeparator from "@/wab/client/components/dashboard/NavSeparator";
import NavTeamSection from "@/wab/client/components/dashboard/NavTeamSection";
import NavWorkspaceButton from "@/wab/client/components/dashboard/NavWorkspaceButton";
import { promptNewTeam } from "@/wab/client/components/dashboard/dashboard-actions";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useApplicationLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultDefaultLayoutProps,
  PlasmicDefaultLayout,
  PlasmicDefaultLayout__OverridesType,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDefaultLayout";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { useBrowserNotification } from "@/wab/client/utils/useBrowserNotification";
import { ApiTeam, ApiWorkspace } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  AppstoreOutlined,
  ExperimentOutlined,
  FolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Dropdown, Layout, Popover, Skeleton } from "antd";
import * as _ from "lodash";
import { observer } from "mobx-react";
import * as React from "react";

export type DefaultLayoutProps = DefaultDefaultLayoutProps &
  PlasmicDefaultLayout__OverridesType & {
    /** Currently active team, if any. */
    team?: ApiTeam;
    /** Currently active workspace, if any. */
    workspace?: ApiWorkspace;
  };

function DefaultLayout_(
  props: DefaultLayoutProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { team, workspace, freeTrial, upgradeButton, ...rest } = props;
  const { t } = useI18n();
  const { styles: layout, cx } = useApplicationLayoutStyles();
  const history = useHistory();
  const appCtx = React.useContext(AppCtxContext);
  const userInfo = appCtx?.selfInfo;

  const [spacesOpen, setSpacesOpen] = React.useState(false);
  const teams = appCtx?.getAllTeams() ?? [];
  const workspaces = _.sortBy(appCtx?.workspaces ?? [], (w) => w.name);

  useBrowserNotification();

  const userMenu = {
    items: [
      {
        key: "settings",
        label: (
          <PublicLink href={APP_ROUTES.settings.fill({})}>
            {t("Settings")}
          </PublicLink>
        ),
      },
      {
        key: "sign-out",
        label: t("Sign Out"),
        onClick: () => appCtx?.logout(),
      },
    ],
  };

  const brand =
    appCtx?.appConfig.brands?.[team?.id ?? ""] ??
    appCtx?.appConfig.brands?.[""];

  const navigationTeams = teams.map((navigationTeam) => (
    <React.Fragment key={navigationTeam.id}>
      <NavSeparator />
      <NavTeamSection
        name={navigationTeam.name}
        href={APP_ROUTES.org.fill({ teamId: navigationTeam.id })}
        selected={team?.id === navigationTeam.id}
        freeTrial={navigationTeam.onTrial}
      >
        {workspaces
          .filter((w) => w.team.id === navigationTeam.id)
          .map((w) => (
            <NavWorkspaceButton
              key={w.id}
              name={w.name}
              href={APP_ROUTES.workspace.fill({
                workspaceId: w.id,
              })}
              selected={workspace?.id === w.id}
            />
          ))}
      </NavTeamSection>
    </React.Fragment>
  ));

  return (
    <PlasmicDefaultLayout
      {...rest}
      root={{
        as: Layout,
        props: {
          ref,
          className: cx(
            styles.applicationLayout,
            layout.root,
            navigator.userAgent.includes("PlasmicDesktop/darwin") &&
              styles.desktopLayout,
            navigator.userAgent.includes("PlasmicDesktop/win32") &&
              styles.windowsLayout,
          ),
        },
      }}
      header={{
        as: Layout.Header,
        props: { className: cx(styles.applicationHeader, layout.header) },
      }}
      headerWrapper={{ className: styles.headerWrapper }}
      headerActions={{
        wrap: (node) => (
          <div className={styles.headerActions}>
            {node}
            {userInfo ? (
              <Dropdown
                menu={userMenu}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button
                  type="text"
                  className={styles.headerAction}
                  data-test-id="btn-dashboard-user"
                  aria-label={userInfo.displayName}
                >
                  <Avatar size="small" user={userInfo} />
                </Button>
              </Dropdown>
            ) : (
              <Skeleton.Avatar active size={32} shape="circle" />
            )}
          </div>
        ),
      }}
      wrapper={{
        as: Layout,
        props: { className: cx(styles.layoutWrapper, layout.wrapper) },
      }}
      sidebar={{ className: cx(styles.sidebar, layout.sidebar) }}
      nav={{
        render: () => (
          <nav className={styles.rail} aria-label={t("All projects")}>
            <PublicLink
              className={cx(
                styles.railItem,
                rest.navigation === "allProjects" && styles.railSelected,
              )}
              href={APP_ROUTES.allProjects.fill({})}
              aria-label={t("All projects")}
            >
              <AppstoreOutlined aria-hidden />
              <span>{t("Projects")}</span>
            </PublicLink>
            <PublicLink
              className={cx(
                styles.railItem,
                rest.navigation === "myProjects" && styles.railSelected,
              )}
              href={APP_ROUTES.playground.fill({})}
              aria-label={t("My Playground")}
              title={t("My Playground")}
            >
              <ExperimentOutlined aria-hidden />
              <span>{t("My Playground")}</span>
            </PublicLink>
            {!rest.hideTeams && (
              <Popover
                trigger="click"
                placement="rightTop"
                open={spacesOpen}
                onOpenChange={setSpacesOpen}
                content={
                  <div
                    className={cx(styles.spacesMenu, layout.sidebar)}
                    onClick={(event) => {
                      if (
                        event.target instanceof Element &&
                        event.target.closest("a")
                      ) {
                        setSpacesOpen(false);
                      }
                    }}
                  >
                    {navigationTeams}
                  </div>
                }
              >
                <button
                  type="button"
                  className={cx(
                    styles.railItem,
                    (spacesOpen || !!team) && styles.railSelected,
                  )}
                  aria-label={t("Spaces")}
                  aria-expanded={spacesOpen}
                  disabled={!appCtx}
                  onClick={() => setSpacesOpen(!spacesOpen)}
                >
                  <FolderOutlined aria-hidden />
                  <span>{t("Spaces")}</span>
                </button>
              </Popover>
            )}
          </nav>
        ),
      }}
      navFooter={{ className: styles.navigationFooter }}
      main={{
        as: Scrollbar,
        props: {
          element: "main",
          scrollX: false,
          className: cx(styles.main, layout.main),
        },
      }}
      headerLogoLink={{
        as: PublicLink,
        wrap: (node) => <div className={styles.brandLink}>{node}</div>,
        props: brand?.logoHref
          ? {
              href: brand.logoHref,
            }
          : {},
      }}
      headerLogo={
        brand?.logoImgSrc
          ? {
              render: () => <img src={brand.logoImgSrc} />,
            }
          : {
              render: () => (
                <span className={styles.brand}>
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M7 3h14a8 8 0 0 1 0 16h-7l4-5h3a3 3 0 0 0 0-6H11z M11 13h7l-4 5h-3a3 3 0 0 0 0 6h10l-4 5h-6a8 8 0 0 1 0-16z" />
                  </svg>
                  Plasmic
                </span>
              ),
            }
      }
      freeTrial={freeTrial ?? { render: () => null }}
      upgradeButton={upgradeButton ?? { render: () => null }}
      helpButton={{ render: () => null }}
      documentationButton={{ render: () => null }}
      newTeamButton={{
        render: () => (
          <button
            type="button"
            className={styles.railItem}
            aria-label={t("New organization")}
            disabled={!appCtx}
            onClick={async () => {
              if (appCtx) {
                await promptNewTeam(appCtx, history);
              }
            }}
          >
            <PlusOutlined aria-hidden />
            <span>{t("Create")}</span>
          </button>
        ),
      }}
      userButton={{ render: () => null }}
    />
  );
}

const DefaultLayout = observer(React.forwardRef(DefaultLayout_));
export default DefaultLayout;
