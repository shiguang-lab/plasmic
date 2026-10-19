import { createSiteForHostlessProject } from "@/wab/server/code-components/code-components";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";

test("React UI is an independent hostless library", async () => {
  const site = await createSiteForHostlessProject(
    new HostLessPackageInfo({
      name: "react-ui",
      npmPkg: ["@shiguang-lab/plasmic-react-ui"],
      cssImport: [],
      deps: [],
      registerCalls: [],
      minimumReactVersion: "18.0.0",
    }),
  );
  expect(site.components.map((component) => ({
    name: component.name,
    isHostLess: component.codeComponentMeta?.isHostLess,
    importPath: component.codeComponentMeta?.importPath,
    importName: component.codeComponentMeta?.importName,
  })).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
    {
      name: "plasmic-react-ui-action-group", isHostLess: true,
      importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerActionGroup",
      importName: "ActionGroup",
    },
    {
      name: "plasmic-react-ui-resource-authorization", isHostLess: true,
      importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerResourceAuthorization",
      importName: "ResourceAuthorization",
    },
    {
      name: "plasmic-react-ui-resource-authorization-record", isHostLess: true,
      importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerResourceAuthorization",
      importName: "ResourceAuthorizationRecord",
    },
  ]);
  for (const component of site.components) {
    const props = component.params.map((param) => param.variable.name);
    if (component.name === "plasmic-react-ui-action-group") {
      expect(props).toContain("onAction");
    } else {
      expect(props).toEqual(expect.arrayContaining(["open", "onOpenChange", "onSuccess", "onClose"]));
      expect(component.states.map((state) => state.param.variable.name)).toContain("open");
    }
  }
});
