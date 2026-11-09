import type { AppCtx } from "@/wab/client/app-ctx";
import { BrandLink } from "@/wab/client/components/BrandLink";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { HelpButton } from "@/wab/client/components/top-bar/HelpButton";
import { useAuthenticatedLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import { InlineIcon } from "@/wab/client/components/widgets";
import { BrowserAlertBanner } from "@/wab/client/components/widgets/BrowserAlertBanner";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import ChevronDownsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import { ensure } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Dropdown, Menu, Skeleton } from "antd";
import * as React from "react";
import { ReactNode } from "react";

function useLayoutBrand(appCtx: AppCtx | undefined) {
  const subscribe = React.useCallback((listener: () => void) => appCtx ? appCtx.subscribeUiEnvironmentInputs(listener) : () => undefined, [appCtx]);
  const read = React.useCallback(() => appCtx?.appConfig.brands?.[""], [appCtx]);
  return React.useSyncExternalStore(subscribe, read, read);
}

interface NormalLayoutComponentProps {
  className?: string;
  topBar?: ReactNode;
  children?: ReactNode;
}
function NormalLayoutComponent(props: NormalLayoutComponentProps) {
  const appCtx = React.useContext(AppCtxContext);
  const brand = useLayoutBrand(appCtx);
  const { topBar } = props;
    return (
      <div
        className={["normal-layout", props.className]
          .filter(Boolean)
          .join(" ")}
      >
        {topBar && (
          <div className={"normal-layout__top-bar"}>
            <div
              className={"normal-layout-content normal-layout-content--top-bar"}
            >
              <div className="normal-layout__brand">
                <BrandLink brand={brand} />
              </div>

              {topBar}
            </div>
          </div>
        )}
        <div className={"normal-layout-content"}>{props.children}</div>
      </div>
    );
}
function AuthenticatedLayout(props: NormalLayoutComponentProps) {
  const { styles } = useAuthenticatedLayoutStyles();
  return <NormalLayoutComponent {...props} className={styles.root} />;
}
export function NormalNonAuthLayout({children}: { children?: React.ReactNode }) {
  return <NormalLayoutComponent>{children}</NormalLayoutComponent>;
}
export function NormalLayout({appCtx, children}: { appCtx: AppCtx; children?: React.ReactNode }) {
  const subscribe = React.useCallback((listener: () => void) => appCtx.subscribeUiEnvironmentInputs(listener), [appCtx]);
  const readUser = React.useCallback(() => appCtx.selfInfo, [appCtx]);
  const selfInfo = React.useSyncExternalStore(subscribe, readUser, readUser);
    const menu = (
      <Menu>
        <Menu.Item>
          <PublicLink href={APP_ROUTES.settings.fill({})}>
            <UiText message={"Settings"} />
          </PublicLink>
        </Menu.Item>
        <Menu.Item
          onClick={async () => {
            await appCtx.logout();
          }}
        >
          <UiText message={"Sign Out"} />
        </Menu.Item>
      </Menu>
    );
    return (
      <>
        <BrowserAlertBanner />
        <AuthenticatedLayout
          topBar={
            <div className={"normal-layout__top-bar-right"}>
              <HelpButton />
              <Dropdown popupRender={() => menu} trigger={["click"]}>
                <div className={"normal-layout__user"}>
                  <Avatar
                    className={"user-avatar"}
                    user={ensure(selfInfo, "must have selfInfo")}
                  />
                  <InlineIcon>
                    <Icon icon={ChevronDownsvgIcon} />
                  </InlineIcon>
                </div>
              </Dropdown>
            </div>
          }
        >
          {children}
        </AuthenticatedLayout>
      </>
    );
}

export function NormalLayoutLoading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout
      topBar={
        <div className="normal-layout__top-bar-right">
          <HelpButton />
          <div className="normal-layout__user">
            <Skeleton.Avatar active size={32} shape="circle" />
          </div>
        </div>
      }
    >
      {children}
    </AuthenticatedLayout>
  );
}
