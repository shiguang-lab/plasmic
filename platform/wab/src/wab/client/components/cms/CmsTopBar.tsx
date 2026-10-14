import { BrandLink } from "@/wab/client/components/BrandLink";
import InlineEditable from "@/wab/client/components/InlineEditable";
import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import CmsLeftTabs from "@/wab/client/components/cms/CmsLeftTabs";
import {
  useCmsDatabase,
  useMutateDatabase,
} from "@/wab/client/components/cms/cms-contexts";
import dashboardStyles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { useApplicationLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import { AppCtxContext, useApi } from "@/wab/client/contexts/AppContexts";
import { DefaultCmsTopBarProps } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsTopBar";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { useMatchedRoute } from "@/wab/client/route/useMatchedRoute";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Skeleton } from "antd";
import * as React from "react";

export type CmsTopBarProps = DefaultCmsTopBarProps;

export const CmsTopBarChrome = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<CmsTopBarProps & { navigation?: React.ReactNode }>
>(function CmsTopBarChrome({ className, children, navigation }, ref) {
  const appCtx = React.useContext(AppCtxContext);
  const { styles: layout } = useApplicationLayoutStyles();
  const { styles, cx } = useCmsLayoutStyles();
  const mac = navigator.userAgent.includes("PlasmicDesktop/darwin");
  const windows = navigator.userAgent.includes("PlasmicDesktop/win32");
  return (
    <div
      ref={ref}
      role="banner"
      className={cx(className, layout.header, styles.topBar)}
      data-desktop-platform={mac ? "mac" : windows ? "windows" : undefined}
    >
      <div className={styles.topBarContext}>
        <div className={dashboardStyles.brandGroup}>
          <div
            className={cx(
              dashboardStyles.brandLink,
              mac && dashboardStyles.desktopBrand,
            )}
          >
            <BrandLink brand={appCtx?.appConfig.brands?.[""]} />
          </div>
          {navigator.userAgent.includes("PlasmicDesktop/") && (
            <span data-desktop-update-slot="header" />
          )}
        </div>
        <span className={styles.topBarDivider} aria-hidden />
        <div className={styles.topBarTitle}>{children}</div>
      </div>
      {navigation}
    </div>
  );
});

function CmsTopBar_(props: CmsTopBarProps, ref: HTMLElementRefOf<"div">) {
  const match = useMatchedRoute(APP_ROUTES.cmsRoot)!;
  const { database } = useCmsDatabase(match.pathParams.databaseId);
  const api = useApi();
  const mutateDatabase = useMutateDatabase();
  const { styles } = useCmsLayoutStyles();
  const { pathname } = useLocation();
  const activeTab = APP_ROUTES.cmsSettings.parse(pathname)
    ? "settings"
    : APP_ROUTES.cmsSchemaRoot.parse(pathname, false)
      ? "schema"
      : "content";
  return (
    <CmsTopBarChrome
      ref={ref}
      {...props}
      navigation={<CmsLeftTabs activeTab={activeTab} />}
    >
      {database ? (
        <InlineEditable
          className={styles.cmsName}
          value={database.name}
          onChange={async (newName) => {
            await api.updateCmsDatabase(database.id, { name: newName });
            await mutateDatabase(database.id);
          }}
        >
          <span className={styles.cmsNameValue} title={database.name}>
            {database.name}
          </span>
        </InlineEditable>
      ) : (
        <Skeleton.Input active style={{ width: 200 }} />
      )}
    </CmsTopBarChrome>
  );
}

const CmsTopBar = React.forwardRef(CmsTopBar_);
export default CmsTopBar;
