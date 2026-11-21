import registerComponent from "@plasmicapp/host/registerComponent";
import registerGlobalContext from "@plasmicapp/host/registerGlobalContext";
import { iconNames } from "./MIcon";
import * as components from "./components";
import { componentMeta, componentName, componentNames } from "./metadata";
export * from "./components";
export { componentMeta, componentNames } from "./metadata";
export type Registerable = {
  registerComponent: typeof registerComponent;
  registerGlobalContext: typeof registerGlobalContext;
};
export function registerAll(loader?: Registerable) {
  for (const name of componentNames) {
    (loader?.registerComponent ?? registerComponent)(
      components[name] as React.ComponentType<any>,
      componentMeta(name),
    );
  }
  (loader?.registerComponent ?? registerComponent)(components.NativeOption, {
    name: componentName("NativeOption"),
    displayName: "NativeOption",
    parentComponentName: componentName("NativeSelect"),
    section: "Inputs",
    importPath: "@shiguang-lab/plasmic-material-ui/components",
    importName: "NativeOption",
    props: {
      value: "string",
      label: "string",
      disabled: "boolean",
      children: { type: "slot", defaultValue: "选项", hidePlaceholder: true },
    },
  });
  (loader?.registerComponent ?? registerComponent)(components.MIcon, {
    name: "plasmic-material-ui-m-icon",
    displayName: "MIcon",
    section: "Data display",
    description:
      "Display an official Material icon by its @mui/icons-material export name.",
    importPath: "@shiguang-lab/plasmic-material-ui/components",
    importName: "MIcon",
    props: {
      name: { type: "choice", options: iconNames, defaultValue: "Search" },
      fontSize: {
        type: "choice",
        options: ["inherit", "small", "medium", "large"],
        defaultValueHint: "medium",
      },
      color: {
        type: "choice",
        options: [
          "inherit",
          "action",
          "disabled",
          "primary",
          "secondary",
          "error",
          "info",
          "success",
          "warning",
        ],
        defaultValueHint: "inherit",
      },
      htmlColor: { type: "color" },
      titleAccess: "string",
      sx: "object",
    },
  });
  (loader?.registerGlobalContext ?? registerGlobalContext)(
    components.MaterialThemeProvider,
    {
      name: "plasmic-material-ui-theme-provider",
      displayName: "Material UI Theme",
      importPath: "@shiguang-lab/plasmic-material-ui/components",
      importName: "MaterialThemeProvider",
      props: {
        theme: {
          type: "object",
          description:
            "MUI ThemeOptions: palette (including mode), typography, spacing, shape, breakpoints and component defaults/style overrides.",
        },
      },
    },
  );
}
