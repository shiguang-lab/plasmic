import registerComponent from "@plasmicapp/host/registerComponent";
import registerGlobalContext from "@plasmicapp/host/registerGlobalContext";
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
      children: { type: "slot", defaultValue: "选项" },
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
