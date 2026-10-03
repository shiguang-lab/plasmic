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
      const nextCatalog = catalog.filter(entry => !["antd5", "antd6"].includes(entry.codeName ?? ""));
      for (const entry of DEVFLAGS.hostLessComponents ?? []) {
        if (entry.syntheticPackage && !nextCatalog.some(item => item.codeName === entry.codeName)) {
          nextCatalog.push(entry);
        }
      }
      for (const version of [5, 6]) {
        const codeName = `antd${version}`;
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
        if (version === 6 && existingPkg) {
          await publishHostlessProject(db, existingPkg.projectId);
        }
        const dependency = existingPkg
          ? await unbundlePkgVersion(
              db, bundler, await db.getPkgVersion(existingPkg.id)
            )
          : await db.createHostLessProject(new HostLessPackageInfo({
              name: codeName,
              npmPkg: [version === 5 ? "@plasmicpkgs/antd5" : "@shiguang-lab/plasmic-antd6"],
              cssImport: [], deps: [], registerCalls: [], minimumReactVersion: "18.0.0",
            }), bundler);
        await db.updateProject({ id: dependency.projectId, readableByPublic: true });
        const imageUrl = "https://plasmic.studio.publib.cn/static/img/antd6.svg";
        const shared = {
          type: "hostless-package" as const, name: `Ant Design ${version}`, codeName,
          codeLink: `https://github.com/shiguang-lab/plasmic/tree/master/plasmicpkgs/${codeName}`,
          imageUrl, projectId: [dependency.projectId],
        };
        nextCatalog.push({
          ...shared, sectionLabel: "Design systems", isInstallOnly: true, isHeaderLess: true,
          items: [{ type: "hostless-component", componentName: `${codeName}-design-system`,
            displayName: `Ant Design System ${version}`, imageUrl }],
        }, {
          ...shared, sectionLabel: "Ant Design",
          items: dependency.site.components.filter(c => !c.codeComponentMeta?.isContext).map(c => ({
            type: "hostless-component", componentName: c.name,
            displayName: c.codeComponentMeta?.displayName ?? c.name,
          })),
        });
        console.log(`Registered Ant Design ${version}: ${dependency.site.components.length} components, project ${dependency.projectId}`);
      }
      flags.hostLessComponents = nextCatalog;
      await db.setDevFlagOverrides(JSON.stringify(flags));
    });
  } finally { await con.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
