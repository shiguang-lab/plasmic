import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultActionMenuButtonProps,
  PlasmicActionMenuButton,
} from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicActionMenuButton";
import { Tooltip } from "antd";
import * as React from "react";

interface ActionMenuButtonProps extends DefaultActionMenuButtonProps {
  style?: React.CSSProperties;
  menu: React.ReactElement | (() => React.ReactElement);
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  tooltip?: React.ReactNode;
  "aria-label"?: string;
}

const ActionMenuButton = React.forwardRef(function ActionMenuButton(
  props: ActionMenuButtonProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const { t: studioUiT } = useI18n();

  const {
    menu,
    onClick,
    href,
    target,
    tooltip,
    "aria-label": ariaLabel,
    ...rest
  } = props;
  const label =
    ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);
  const [tooltipVisible, setTooltipVisible] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);

  return (
    <PlasmicActionMenuButton
      {...rest}
      actionButton={{
        props: {
          onClick,
          href,
          target,
          className: "btn-link",
          "aria-label": label,
        },
        as: href ? "a" : "button",
      }}
      menuTrigger={{
        props: {
          "aria-label": studioUiT("{part1} menu", {
            part1: String(
              label ??
                (typeof props.children === "string"
                  ? props.children
                  : studioUiT("Actions")),
            ),
          }),
        },
        wrap: (x) => (
          <IFrameAwareDropdownMenu
            menu={menu}
            onVisibleChange={(visible) => {
              setMenuVisible(visible);
              if (visible) {
                setTooltipVisible(false);
              }
            }}
          >
            {x}
          </IFrameAwareDropdownMenu>
        ),
      }}
      root={{
        props: {
          ref,
        },

        wrap: (x) =>
          tooltip ? (
            <Tooltip
              title={tooltip}
              open={tooltipVisible}
              onOpenChange={(visible) => {
                setTooltipVisible(visible && !menuVisible);
              }}
            >
              <TriggerTarget>{x}</TriggerTarget>
            </Tooltip>
          ) : (
            x
          ),
      }}
    />
  );
});

export default ActionMenuButton;
