import { PublicLink } from "@/wab/client/components/PublicLink";
import NavSeparator from "@/wab/client/components/dashboard/NavSeparator";
import NavTeamSection from "@/wab/client/components/dashboard/NavTeamSection";
import NavWorkspaceButton from "@/wab/client/components/dashboard/NavWorkspaceButton";
import { promptNewTeam } from "@/wab/client/components/dashboard/dashboard-actions";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useApplicationLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultDefaultLayoutProps,
  PlasmicDefaultLayout,
  PlasmicDefaultLayout__OverridesType,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDefaultLayout";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { useBrowserNotification } from "@/wab/client/utils/useBrowserNotification";
import { ApiTeam, ApiWorkspace } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Dropdown, Layout } from "antd";
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
  const { team, workspace, freeTrial, upgradeButton, helpButton, ...rest } =
    props;
  const { t } = useI18n();
  const { styles: layout, cx } = useApplicationLayoutStyles();
  const history = useHistory();
  const appCtx = useAppCtx();
  const userInfo = ensure(
    appCtx.selfInfo,
    "DefaultLayout requires appCtx to contain user information",
  );

  const teams = appCtx.getAllTeams();
  const workspaces = _.sortBy(appCtx.workspaces, (w) => w.name);

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
      { key: "sign-out", label: t("Sign Out"), onClick: () => appCtx.logout() },
    ],
  };

  const brand =
    appCtx.appConfig.brands?.[team?.id ?? ""] ?? appCtx.appConfig.brands?.[""];

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
          ),
        },
      }}
      header={{
        as: Layout.Header,
        props: { className: cx(styles.applicationHeader, layout.header) },
      }}
      headerWrapper={{ className: styles.headerWrapper }}
      wrapper={{
        as: Layout,
        props: { className: cx(styles.layoutWrapper, layout.wrapper) },
      }}
      sidebar={{ className: cx(styles.sidebar, layout.sidebar) }}
      nav={{
        as: Scrollbar,
        props: {
          element: "nav",
          scrollX: false,
          className: styles.navigation,
        },
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
        props: brand.logoHref
          ? {
              href: brand.logoHref,
            }
          : {},
      }}
      headerLogo={
        brand.logoImgSrc
          ? {
              render: () => <img src={brand.logoImgSrc} />,
            }
          : undefined
      }
      freeTrial={freeTrial ?? { render: () => null }}
      teams={teams.map((navigationTeam) => (
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
      ))}
      upgradeButton={upgradeButton ?? { render: () => null }}
      helpButton={helpButton ?? { children: t("Help") }}
      allProjectsButton={{ children: t("All projects") }}
      myProjectsButton={{ children: t("My Playground") }}
      documentationButton={{ children: t("Documentation") }}
      newTeamButton={{
        children: t("New organization"),
        onClick: async () => {
          await promptNewTeam(appCtx, history);
        },
      }}
      userButton={{
        props: {
          children: userInfo.displayName,
          "data-test-id": "btn-dashboard-user",
        },
        wrap: (node) => (
          <Dropdown menu={userMenu} placement="topLeft" trigger={["click"]}>
            {node}
          </Dropdown>
        ),
      }}
      avatar={<Avatar size="small" user={userInfo} />}
    />
  );
}

const DefaultLayout = observer(React.forwardRef(DefaultLayout_));
export default DefaultLayout;
