import { publishHostlessProject } from "@/wab/server/db/PublishHostless";
import { loadConfig } from "@/wab/server/config";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { ensure, ensureArray } from "@/wab/shared/common";
import { Bundler } from "@/wab/shared/bundler";
import { DEVFLAGS, HostLessPackageInfo as CatalogPackage } from "@/wab/shared/devflags";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";

async function main() {
  const con = await ensureDbConnection(loadConfig().databaseUri, "default");
  try {
    await con.transaction(async em => {
      const db = new DbMgr(em, SUPER_USER);
      const flags = JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}");
      const catalog: CatalogPackage[] = flags.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
      const nextCatalog = catalog.filter(entry => !["antd5", "antd6", "overseas"].includes(entry.codeName ?? ""));
      for (const entry of DEVFLAGS.hostLessComponents ?? []) {
        if (entry.syntheticPackage && !nextCatalog.some(item => item.codeName === entry.codeName)) {
          nextCatalog.push(entry);
        }
      }
      for (const library of [
        { codeName: "antd5", name: "Ant Design 5", npmPkg: "@plasmicpkgs/antd5", image: "antd6.svg" },
        { codeName: "antd6", name: "Ant Design 6", npmPkg: "@shiguang-lab/plasmic-antd6", image: "antd6.svg" },
        { codeName: "overseas", name: "Overseas", npmPkg: "@shiguang-lab/plasmic-overseas", image: "overseas.svg" },
      ]) {
        const { codeName } = library;
        const existing = catalog.find(entry => entry.codeName === codeName);
        const bundler = new Bundler();
        const existingPkg = existing
          ? ensure(
              await db.getPkgByProjectId(
                ensure(ensureArray(existing.projectId)[0], "Missing Ant Design project")
              ),
              "Missing Ant Design package"
            )
          : undefined;
        if (codeName !== "antd5" && existingPkg) {
          await publishHostlessProject(db, existingPkg.projectId, {
            removedParams: { [`plasmic-${codeName}-app-shell`]: ["breadcrumbItems"] },
          });
        }
        const dependency = existingPkg
          ? await unbundlePkgVersion(
              db, bundler, await db.getPkgVersion(existingPkg.id)
            )
          : await db.createHostLessProject(new HostLessPackageInfo({
              name: codeName,
              npmPkg: [library.npmPkg],
              cssImport: [], deps: [], registerCalls: [], minimumReactVersion: "18.0.0",
            }), bundler);
        await db.updateProject({ id: dependency.projectId, readableByPublic: true });
        const imageUrl = `https://plasmic.studio.publib.cn/static/img/${library.image}`;
        const shared = {
          type: "hostless-package" as const, name: library.name, codeName,
          codeLink: `https://github.com/shiguang-lab/plasmic/tree/master/plasmicpkgs/${codeName}`,
          imageUrl, projectId: [dependency.projectId],
        };
        nextCatalog.push({
          ...shared, sectionLabel: codeName === "overseas" ? "Business components" : "Design systems", isInstallOnly: true, isHeaderLess: true,
          items: [{ type: "hostless-component", componentName: `${codeName}-design-system`,
            displayName: library.name, imageUrl }],
        }, {
          ...shared, sectionLabel: codeName === "overseas" ? "Business components" : "Ant Design",
          items: dependency.site.components.filter(c => !c.codeComponentMeta?.isContext).map(c => ({
            type: "hostless-component", componentName: c.name,
            displayName: c.codeComponentMeta?.displayName ?? c.name,
            ...(codeName === "antd6" && c.name === "plasmic-antd6-app-shell" ? { hidden: true } : {}),
          })),
        });
        console.log(`Registered ${library.name}: ${dependency.site.components.length} components, project ${dependency.projectId}`);
      }
      flags.hostLessComponents = nextCatalog;
      await db.setDevFlagOverrides(JSON.stringify(flags));
    });
  } finally { await con.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
