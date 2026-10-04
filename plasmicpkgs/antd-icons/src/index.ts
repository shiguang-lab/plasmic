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
    const svg = icon.svg.replace(
      'width="1em" height="1em"',
      'x="80" y="40" width="32" height="32"',
    );
    const thumbnail = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="112" viewBox="0 0 192 112" color="#1f1f1f">${svg}</svg>`;
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
        thumbnailUrl: `data:image/svg+xml,${encodeURIComponent(thumbnail)}`,
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
