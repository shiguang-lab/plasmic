import DefaultLayout, {
  DefaultLayoutProps,
} from "@/wab/client/components/dashboard/DefaultLayout";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export type DefaultTeamLayoutProps = DefaultLayoutProps;

function DefaultTeamLayout_(
  props: DefaultTeamLayoutProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { team, ...rest } = props;

  return (
    <DefaultLayout
      ref={ref}
      {...rest}
      team={team}
      freeTrial={team ? { team } : undefined}
    />
  );
}

const DefaultTeamLayout = React.forwardRef(DefaultTeamLayout_);
export default DefaultTeamLayout;
