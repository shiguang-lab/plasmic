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
  expect(site.components).toHaveLength(1);
  expect(site.components[0].name).toBe("plasmic-react-ui-action-group");
  expect(site.components[0].codeComponentMeta).toMatchObject({
    isHostLess: true,
    importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerActionGroup",
    importName: "ActionGroup",
  });
  expect(
    site.components[0].params.map((param) => param.variable.name),
  ).toContain("onAction");
});
