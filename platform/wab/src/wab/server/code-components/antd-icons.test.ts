import { createSiteForHostlessProject } from "@/wab/server/code-components/code-components";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";

test("Ant Design Icons installs as an independent hostless library", async () => {
  const site = await createSiteForHostlessProject(
    new HostLessPackageInfo({
      name: "antd-icons",
      npmPkg: ["@ant-design/icons"],
      cssImport: [],
      deps: [],
      registerCalls: [],
      minimumReactVersion: "18.0.0",
    }),
  );
  expect(site.components).toHaveLength(848);
  expect(site.imageAssets).toHaveLength(0);
  const plus = site.components.find(
    (component) => component.name === "plasmic-antd-icon-PlusOutlined",
  );
  expect(plus?.codeComponentMeta).toMatchObject({
    isHostLess: true,
    importPath: "@ant-design/icons",
    importName: "PlusOutlined",
    section: "Outlined",
  });
  expect(plus?.params.map((param) => param.variable.name)).toContain("spin");
  expect(plus?.params.map((param) => param.variable.name)).not.toContain(
    "name",
  );
});
