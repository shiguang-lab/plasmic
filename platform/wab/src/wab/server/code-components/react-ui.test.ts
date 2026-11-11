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
    ...[
      ["department-select", "IntlDepartmentSelect"],
      ["department-view", "IntlDepartmentView"],
      ["dict-select", "IntlDictSelect"],
      ["dict-view", "IntlDictView"],
      ["user-select", "IntlUserSelect"],
      ["user-view", "IntlUserView"],
    ].map(([suffix, importName]) => ({
      name: `plasmic-react-ui-intl-${suffix}`,
      isHostLess: true,
      importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerIntlComponents",
      importName,
    })),
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
    } else if (component.name.startsWith("plasmic-react-ui-intl-")) {
      expect(props).toContain("value");
      const states = component.states.map((state) => state.param.variable.name);
      if (component.name.endsWith("-select")) {
        expect(props).toContain("onChange");
        expect(states).toContain("value");
      } else {
        expect(states).toEqual([]);
      }
    } else {
      expect(props).toEqual(expect.arrayContaining(["open", "onOpenChange", "onSuccess", "onClose"]));
      expect(component.states.map((state) => state.param.variable.name)).toContain("open");
    }
  }
});
