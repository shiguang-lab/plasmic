import {
  AppComponent,
  NonAuthComponent,
  NonAuthComponentProps,
} from "@/wab/client/app-ctx";
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

interface NormalLayoutComponentProps {
  className?: string;
  topBar?: ReactNode;
  children?: ReactNode;
}
class NormalLayoutComponent extends React.Component<
  NormalLayoutComponentProps,
  {}
> {
  static contextType = AppCtxContext;
  declare context: React.ContextType<typeof AppCtxContext>;

  render() {
    const { topBar } = this.props;
    return (
      <div
        className={["normal-layout", this.props.className]
          .filter(Boolean)
          .join(" ")}
      >
        {topBar && (
          <div className={"normal-layout__top-bar"}>
            <div
              className={"normal-layout-content normal-layout-content--top-bar"}
            >
              <div className="normal-layout__brand">
                <BrandLink brand={this.context?.appConfig.brands?.[""]} />
              </div>

              {topBar}
            </div>
          </div>
        )}
        <div className={"normal-layout-content"}>{this.props.children}</div>
      </div>
    );
  }
}
function AuthenticatedLayout(props: NormalLayoutComponentProps) {
  const { styles } = useAuthenticatedLayoutStyles();
  return <NormalLayoutComponent {...props} className={styles.root} />;
}
interface NormalNonAuthLayoutProps extends NonAuthComponentProps {
  children?: React.ReactNode;
}
export class NormalNonAuthLayout extends NonAuthComponent<
  NormalNonAuthLayoutProps,
  {}
> {
  render() {
    return <NormalLayoutComponent>{this.props.children}</NormalLayoutComponent>;
  }
}
export class NormalLayout extends AppComponent {
  render() {
    const menu = (
      <Menu>
        <Menu.Item>
          <PublicLink href={APP_ROUTES.settings.fill({})}>
            <UiText message={"Settings"} />
          </PublicLink>
        </Menu.Item>
        <Menu.Item
          onClick={async () => {
            await this.logout();
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
                    user={ensure(this.appCtx().selfInfo, "must have selfInfo")}
                  />
                  <InlineIcon>
                    <Icon icon={ChevronDownsvgIcon} />
                  </InlineIcon>
                </div>
              </Dropdown>
            </div>
          }
        >
          {this.props.children}
        </AuthenticatedLayout>
      </>
    );
  }
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
