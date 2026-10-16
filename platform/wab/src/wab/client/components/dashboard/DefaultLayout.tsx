import { BrandLink } from "@/wab/client/components/BrandLink";
import { PublicLink } from "@/wab/client/components/PublicLink";
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
import { Button, Dropdown, Layout, Segmented, Skeleton, Tooltip } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

export type DefaultLayoutProps = Omit<DefaultDefaultLayoutProps, "navigation"> &
  PlasmicDefaultLayout__OverridesType & {
    navigation?: "allProjects" | "myProjects" | "spaces";
    /** Currently active team, if any. */
    team?: ApiTeam;
    /** Currently active workspace, if any. */
    workspace?: ApiWorkspace;
  };

function DefaultLayout_(
  props: DefaultLayoutProps,
  ref: HTMLElementRefOf<"div">,
) {
  const {
    team,
    workspace: _workspace,
    navigation: activeTab,
    freeTrial,
    upgradeButton,
    ...rest
  } = props;
  const { t } = useI18n();
  const { styles: layout, cx } = useApplicationLayoutStyles();
  const history = useHistory();
  const appCtx = React.useContext(AppCtxContext);
  const userInfo = appCtx?.selfInfo;

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

  const activeNavigation =
    activeTab ?? (team && !rest.hideTeams ? "spaces" : "");
  const navigation = (
    <Segmented
      aria-label={t("Spaces")}
      className={styles.navigation}
      value={activeNavigation}
      onChange={(value) => {
        history.push(
          value === "allProjects"
            ? APP_ROUTES.allProjects.fill({})
            : value === "myProjects"
              ? APP_ROUTES.playground.fill({})
              : APP_ROUTES.organizations.fill({}),
        );
      }}
      options={[
        {
          value: "allProjects",
          label: (
            <span className={styles.navigationLabel}>
              <AppstoreOutlined aria-hidden />
              {t("Projects")}
            </span>
          ),
        },
        {
          value: "myProjects",
          label: (
            <span className={styles.navigationLabel}>
              <ExperimentOutlined aria-hidden />
              {t("My Playground")}
            </span>
          ),
        },
        ...(!rest.hideTeams
          ? [
              {
                value: "spaces",
                disabled: !appCtx,
                label: (
                  <span className={styles.navigationLabel}>
                    <FolderOutlined aria-hidden />
                    {t("Spaces")}
                  </span>
                ),
              },
            ]
          : []),
      ]}
    />
  );

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
          <div className={cx(styles.headerActions, layout.headerActions)}>
            {navigation}
            <span className={styles.headerDivider} aria-hidden />
            <Tooltip
              title={t("New organization")}
              arrow={false}
              styles={{ container: { textAlign: "center" } }}
            >
              <Button
                type="text"
                className={cx(styles.headerAction, styles.headerCreate)}
                aria-label={t("New organization")}
                icon={<PlusOutlined aria-hidden />}
                disabled={!appCtx}
                onClick={async () => {
                  if (appCtx) {
                    await promptNewTeam(appCtx, history);
                  }
                }}
              >
                {t("New organization")}
              </Button>
            </Tooltip>
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
              <Skeleton.Avatar active size={28} shape="circle" />
            )}
          </div>
        ),
      }}
      wrapper={{
        as: Layout,
        props: { className: cx(styles.layoutWrapper, layout.wrapper) },
      }}
      sidebar={{ render: () => null }}
      main={{
        as: Scrollbar,
        props: {
          element: "main",
          scrollX: false,
          className: cx(
            styles.main,
            layout.main,
            activeTab === "spaces" && styles.spacesMain,
          ),
        },
      }}
      headerLogoLink={{
        render: () => (
          <div className={styles.brandGroup}>
            <div
              className={cx(
                styles.brandLink,
                navigator.userAgent.includes("PlasmicDesktop/darwin") &&
                  styles.desktopBrand,
              )}
            >
              <BrandLink brand={brand} />
            </div>
            {navigator.userAgent.includes("PlasmicDesktop/") && (
              <span data-desktop-update-slot="header" />
            )}
          </div>
        ),
      }}
      freeTrial={freeTrial ?? { render: () => null }}
      upgradeButton={upgradeButton ?? { render: () => null }}
      userButton={{ render: () => null }}
    />
  );
}

const DefaultLayout = observer(React.forwardRef(DefaultLayout_));
export default DefaultLayout;
