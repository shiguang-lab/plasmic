import { BrandLogo } from "@/wab/client/components/BrandLogo";
import * as React from "react";

export type MarkIconProps = React.ComponentProps<"svg"> & { title?: string };

export function MarkIcon(props: MarkIconProps) {
  return <BrandLogo {...props} className={`plasmic-default__svg ${props.className ?? ""}`} />;
}

export default MarkIcon;
