import { BrandLogo } from "@/wab/client/components/BrandLogo";
import * as React from "react";

export type MarkFullColorIconProps = React.ComponentProps<"svg"> & { title?: string };

export function MarkFullColorIcon(props: MarkFullColorIconProps) {
  return <BrandLogo {...props} className={`plasmic-default__svg ${props.className ?? ""}`} />;
}

export default MarkFullColorIcon;
