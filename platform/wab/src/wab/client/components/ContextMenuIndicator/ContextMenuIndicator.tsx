import { MenuType, useContextMenu } from "@/wab/client/components/ContextMenu";
import MenuButton from "@/wab/client/components/widgets/MenuButton";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultContextMenuIndicatorProps,
  PlasmicContextMenuIndicator,
} from "@/wab/client/plasmic/plasmic_kit_context_menu_indicator/PlasmicContextMenuIndicator";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Tooltip } from "antd";
import * as React from "react";
import { ReactNode, createContext, useState } from "react";
import * as Signals from "signals";

function createContextMenuContext() {
  return {
    onClickSignal: new Signals.Signal(),
    onPointerDownSignal: new Signals.Signal(),
    onPointerEnterSignal: new Signals.Signal(),
    onPointerLeaveSignal: new Signals.Signal(),
    editDynamicValue: () => {},
    setOpenTooltip: (state: undefined | boolean) => {},
  };
}

export const ContextMenuContext = createContext(createContextMenuContext());

export interface ContextMenuIndicatorProps extends DefaultContextMenuIndicatorProps {
  /**
   * Tooltip shown when hovering the green dynamic value button.
   * Defaults to "Use dynamic value".
   */
  tooltip?: ReactNode;
  /** Click listener for the green dynamic value button. */
  onIndicatorClickDefault?: () => void;
  /** Menu to show on context menu indicator (3 dot icon). */
  menu?: MenuType;
  /** Whether to show the menu when right-clicking the children. */
  showMenuOnRightClick?: boolean;
  /** Whether to show the green dynamic value button and highlight effect. */
  showDynamicValueButton?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Shows a context menu indicator (usually 3 dot icon) and
 * an optional green dynamic value button and highlight effect.
 */
function ContextMenuIndicator_(
  {
    menu,
    onIndicatorClickDefault,
    tooltip: tooltipProp,
    showDynamicValueButton = false,
    showMenuOnRightClick = false,
    style,
    className,
    ...props
  }: ContextMenuIndicatorProps,
  ref: HTMLElementRefOf<"div">,
) {
  const [openTooltip, setOpenTooltip] = useState<boolean | undefined>(
    undefined,
  );
  const tooltip = tooltipProp === undefined ? <UiText message="Use dynamic value" /> : tooltipProp;
  const [signals] = useState(createContextMenuContext);
  const ctx = React.useMemo(() => ({
    ...signals,
    setOpenTooltip,
    editDynamicValue: onIndicatorClickDefault ?? signals.editDynamicValue,
  }), [signals, onIndicatorClickDefault, setOpenTooltip]);
  const contextMenuProps = useContextMenu({
    menu: showMenuOnRightClick ? menu : undefined,
  });
  return (
    <ContextMenuContext.Provider value={ctx}>
      <PlasmicContextMenuIndicator
        root={{
          ref,
          style,
          className,
          ...contextMenuProps,
        }}
        {...props}
        contextMenu={
          menu && (
            <div className={"baseline-friendly-centered-block-container"}>
              <MenuButton
                menu={menu}
                // Make it fit within the small right margin
                style={{ paddingLeft: 0, paddingRight: 0, width: 18 }}
              />
            </div>
          )
        }
        contextMenuIndicatorInner={{
          wrap: (node) =>
            !showDynamicValueButton ? null : (
              <Tooltip title={openTooltip === false ? null : tooltip}>
                <TriggerTarget>{node}</TriggerTarget>
              </Tooltip>
            ),
          props: {
            menuIndicator: {
              onPointerEnter: () => ctx.onPointerEnterSignal.dispatch(),
              onPointerLeave: () => ctx.onPointerLeaveSignal.dispatch(),
              onPointerDown: () => ctx.onPointerDownSignal.dispatch(),
              onClick: () => {
                ctx.onClickSignal.dispatch();
                if (ctx.onClickSignal.getNumListeners() === 0) {
                  onIndicatorClickDefault?.();
                }
              },
            },
          },
        }}
        // Don't display contextMenuContainer if there's no menu,
        // as it can block clicks sometimes
        contextMenuContainer={
          menu
            ? undefined
            : {
                style: { display: "none" },
              }
        }
      />
    </ContextMenuContext.Provider>
  );
}

const ContextMenuIndicator = React.forwardRef(ContextMenuIndicator_);
export default ContextMenuIndicator;
