import { PublicLink } from "@/wab/client/components/PublicLink";
import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import { useCmsDatabase } from "@/wab/client/components/cms/cms-contexts";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { DefaultCmsLeftTabsProps } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsLeftTabs";
import { useMatchedRoute } from "@/wab/client/route/useMatchedRoute";
import { CmsDatabaseId, CmsTableId } from "@/wab/shared/ApiSchema";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { ensure } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  DatabaseOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export type CmsLeftTabsProps = DefaultCmsLeftTabsProps;

export const CmsNavigation = React.forwardRef<
  HTMLDivElement,
  CmsLeftTabsProps & {
    contentHref?: string;
    schemaHref?: string;
    settingsHref?: string;
    hideSettings?: boolean;
  }
>(function CmsNavigation(
  { className, activeTab, contentHref, schemaHref, settingsHref, hideSettings },
  ref,
) {
  const { styles, cx } = useCmsLayoutStyles();
  const { t } = useI18n();
  return (
    <nav
      ref={ref}
      className={cx(className, styles.navigation)}
      aria-label={t("CMS Settings")}
    >
      {[
        {
          key: "content",
          label: t("Content"),
          href: contentHref,
          icon: <FileTextOutlined aria-hidden />,
          testId: "cmsContent",
        },
        {
          key: "schema",
          label: t("Models"),
          href: schemaHref,
          icon: <DatabaseOutlined aria-hidden />,
          testId: "cmsModels",
        },
        ...(!hideSettings
          ? [
              {
                key: "settings",
                label: t("Settings"),
                href: settingsHref,
                icon: <SettingOutlined aria-hidden />,
                testId: "cmsSettings",
              },
            ]
          : []),
      ].map(({ key, label, href, icon, testId }) => (
        <PublicLink
          key={key}
          href={href}
          className={styles.navigationItem}
          aria-current={activeTab === key ? "page" : undefined}
          data-test-id={testId}
        >
          {icon}
          {label}
        </PublicLink>
      ))}
    </nav>
  );
});

function CmsLeftTabs_(props: CmsLeftTabsProps, ref: HTMLElementRefOf<"div">) {
  const appCtx = useAppCtx();
  const match = useMatchedRoute<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
  }>()!;
  const params = { databaseId: match.pathParams.databaseId };
  const { database } = useCmsDatabase(match.pathParams.databaseId);

  if (!database) {
    return null;
  }

  const team = ensure(
    appCtx.workspaces.find((w) => w.id === database.workspaceId),
    "Expected existing workspace",
  ).team;

  const shouldHideSettingsButton =
    accessLevelRank(
      appCtx.perms.find(
        (p) =>
          (p.workspaceId === database.workspaceId || p.teamId === team.id) &&
          p.userId ===
            ensure(appCtx.selfInfo, "Unexpected nullish selfInfo").id,
      )?.accessLevel || "blocked",
    ) < accessLevelRank("editor");
  return (
    <CmsNavigation
      {...props}
      ref={ref}
      contentHref={
        match.pathParams.tableId
          ? APP_ROUTES.cmsModelContent.fill({
              ...params,
              tableId: match.pathParams.tableId,
            })
          : APP_ROUTES.cmsContentRoot.fill(params)
      }
      schemaHref={
        match.pathParams.tableId
          ? APP_ROUTES.cmsModelSchema.fill({
              ...params,
              tableId: match.pathParams.tableId,
            })
          : APP_ROUTES.cmsSchemaRoot.fill(params)
      }
      settingsHref={APP_ROUTES.cmsSettings.fill(params)}
      hideSettings={shouldHideSettingsButton}
    />
  );
}

const CmsLeftTabs = React.forwardRef(CmsLeftTabs_);
export default CmsLeftTabs;
