import { loadConfig } from "@/wab/server/config";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { publishHostlessProject } from "@/wab/server/db/PublishHostless";
import { Bundler } from "@/wab/shared/bundler";
import { ensure, ensureArray } from "@/wab/shared/common";
import {
  HostLessPackageInfo as CatalogPackage,
  DEVFLAGS,
} from "@/wab/shared/devflags";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";

async function main() {
  const con = await ensureDbConnection(loadConfig().databaseUri, "default");
  try {
    await con.transaction(async (em) => {
      const db = new DbMgr(em, SUPER_USER);
      const flags = JSON.parse(
        (await db.tryGetDevFlagOverrides())?.data ?? "{}",
      );
      const catalog: CatalogPackage[] =
        flags.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
      const existing = catalog.find((entry) => entry.codeName === "react-ui");
      const bundler = new Bundler();
      const pkg = existing
        ? ensure(
            await db.getPkgByProjectId(
              ensure(
                ensureArray(existing.projectId)[0],
                "Missing React UI project",
              ),
            ),
            "Missing React UI package",
          )
        : undefined;
      if (pkg) {
        await publishHostlessProject(db, pkg.projectId);
      }
      const dependency = pkg
        ? await unbundlePkgVersion(db, bundler, await db.getPkgVersion(pkg.id))
        : await db.createHostLessProject(
            new HostLessPackageInfo({
              name: "react-ui",
              npmPkg: ["@shiguang-lab/plasmic-react-ui"],
              cssImport: [],
              deps: [],
              registerCalls: [],
              minimumReactVersion: "18.0.0",
            }),
            bundler,
          );
      await db.updateProject({
        id: dependency.projectId,
        readableByPublic: true,
      });
      const imageUrl =
        "https://plasmic.studio.publib.cn/static/img/react-ui.svg";
      const entry: CatalogPackage = {
        type: "hostless-package",
        name: "React UI",
        codeName: "react-ui",
        codeLink:
          "https://github.com/shiguang-lab/plasmic/tree/master/plasmicpkgs/react-ui",
        projectId: [dependency.projectId],
        sectionLabel: "Business components",
        imageUrl,
        isInstallOnly: true,
        isHeaderLess: true,
        items: [
          {
            type: "hostless-component",
            componentName: "react-ui-library",
            displayName: "React UI",
            imageUrl,
          },
        ],
      };
      flags.hostLessComponents = [
        ...catalog.filter((item) => item.codeName !== "react-ui"),
        entry,
      ];
      await db.setDevFlagOverrides(JSON.stringify(flags));
      console.log(
        `Registered React UI: ${dependency.site.components.length} components, project ${dependency.projectId}`,
      );
    });
  } finally {
    await con.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
