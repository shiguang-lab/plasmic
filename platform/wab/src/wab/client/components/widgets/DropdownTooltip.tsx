import { Dropdown, Tooltip } from "antd";
import * as React from "react";

export interface DropdownTooltipProps extends React.ComponentProps<
  typeof Dropdown
> {
  title?: React.ReactNode;
}

/**
 * Combination of Dropdown and Tooltip that hides the Tooltip when the Dropdown
 * is shown
 */
export function DropdownTooltip(props: DropdownTooltipProps) {
  const { title, children, popupRender, ...rest } = props;
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isTooltipShown, setTooltipShown] = React.useState(false);
  return (
    <Dropdown
      {...rest}
      open={isDropdownOpen}
      onOpenChange={(visible) => {
        setDropdownOpen(visible);
        if (!visible) {
          setTooltipShown(false);
        }
      }}
      popupRender={(originNode) => {
        const elt = popupRender?.(originNode) ?? originNode;
        if (
          !React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(
            elt,
          )
        ) {
          return elt;
        }
        return React.cloneElement(elt, {
          onClick: (e: React.MouseEvent) => {
            elt.props.onClick?.(e);
            setDropdownOpen(false);
            setTooltipShown(false);
          },
        });
      }}
    >
      <Tooltip
        title={title}
        arrow={false}
        open={isTooltipShown && !isDropdownOpen}
        onOpenChange={(visible) => setTooltipShown(visible)}
      >
        {children}
      </Tooltip>
    </Dropdown>
  );
}
