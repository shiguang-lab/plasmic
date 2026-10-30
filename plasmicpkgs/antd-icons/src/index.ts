import * as Icons from "@ant-design/icons";
import type { IconBaseProps } from "@ant-design/icons/lib/components/Icon";
import registerComponent from "@plasmicapp/host/registerComponent";
import type React from "react";
import catalog from "./catalog.json";

type Registerable = { registerComponent: typeof registerComponent };
const sections = {
  outlined: "Outlined",
  filled: "Filled",
  twotone: "Two Tone",
};

export function registerAll(loader?: Registerable) {
  for (const icon of catalog) {
    (loader?.registerComponent ?? registerComponent)(
      Icons[
        icon.name as keyof typeof Icons
      ] as React.ComponentType<IconBaseProps>,
      {
        name: `plasmic-antd-icon-${icon.name}`,
        displayName: icon.name,
        importPath: "@ant-design/icons",
        importName: icon.name,
        section: sections[icon.theme as keyof typeof sections],
        props: {
          spin: { type: "boolean", defaultValueHint: false },
          rotate: "number",
          ...(icon.theme === "twotone"
            ? { twoToneColor: { type: "color" as const } }
            : {}),
        },
        defaultStyles: { fontSize: "16px" },
      },
    );
  }
}
