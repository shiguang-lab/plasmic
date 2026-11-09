import cn from "classnames";
import React from "react";

export type SvgIcon = React.ComponentType<React.ComponentProps<"svg">>;

export type IconProps = React.ComponentProps<"svg"> & {
  monochromeExempt?: boolean;
  icon: SvgIcon;
  size?: number | string;
};

/** SVG icons forward native props, including React 19's ref prop. */
export function Icon({ icon: IconType, className, monochromeExempt, size = 16, style, ...rest }: IconProps) {
  return (
    <IconType
      className={cn("custom-svg-icon", className, { "monochrome-exempt": monochromeExempt })}
      style={{ width: size, height: size, ...style }}
      {...rest}
    />
  );
}
