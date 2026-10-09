import DefaultLayout, {
  DefaultLayoutProps,
} from "@/wab/client/components/dashboard/DefaultLayout";
import { useI18n } from "@/wab/client/i18n";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export type DefaultTeamLayoutProps = DefaultLayoutProps;

function DefaultTeamLayout_(
  props: DefaultTeamLayoutProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { team, ...rest } = props;
  const { t } = useI18n();

  return (
    <DefaultLayout
      ref={ref}
      {...rest}
      team={team}
      freeTrial={team ? { team } : undefined}
      helpButton={
        // Support is per org, so the playground (personal team) has none.
        !team || team.personalTeamOwnerId
          ? { render: () => null }
          : {
              props: {
                children: t("Help"),
                href: APP_ROUTES.orgSupport.fill({ teamId: team.id }),
              },
            }
      }
    />
  );
}

const DefaultTeamLayout = React.forwardRef(DefaultTeamLayout_);
export default DefaultTeamLayout;
