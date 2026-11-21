import * as icons from "@mui/icons-material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons)
  .filter((name) => name !== "default")
  .sort();

const availableIcons = new Set(iconNames);

export interface MIconProps extends Omit<SvgIconProps, "name" | "children"> {
  name?: IconName;
}

export const MIcon = React.forwardRef<SVGSVGElement, MIconProps>(function MIcon(
  { name = "Search", ...props },
  ref,
) {
  const Icon = availableIcons.has(name) ? icons[name] : undefined;
  return Icon ? <Icon {...props} ref={ref} /> : null;
});
