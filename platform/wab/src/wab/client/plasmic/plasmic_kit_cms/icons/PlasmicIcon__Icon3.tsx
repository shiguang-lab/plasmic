import { BrandLogo } from "@/wab/client/components/BrandLogo";
import * as React from "react";

export type Icon3IconProps = React.ComponentProps<"svg"> & { title?: string };

export function Icon3Icon(props: Icon3IconProps) {
  return <BrandLogo {...props} className={`plasmic-default__svg ${props.className ?? ""}`} />;
}

export default Icon3Icon;
