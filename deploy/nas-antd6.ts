import { loadConfig } from "@/wab/server/config";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { Bundler } from "@/wab/shared/bundler";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";


async function main() {
  const con = await ensureDbConnection(loadConfig().databaseUri, "default");
  try {
    await con.transaction(async em => {
      const db = new DbMgr(em, SUPER_USER);
      const flags = JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}");
      const catalog = flags.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
      if (catalog.some((entry: { codeName?: string }) => entry.codeName === "antd6")) {
        console.log("Ant Design 6 is already installed");
        return;
      }
      const dependency = await db.createHostLessProject(new HostLessPackageInfo({
        name: "antd6", npmPkg: ["@shiguang-lab/plasmic-antd6"], cssImport: [],
        deps: [], registerCalls: [], minimumReactVersion: "18.0.0",
      }), new Bundler());
      await db.updateProject({ id: dependency.projectId, readableByPublic: true });
      flags.hostLessComponents = [...catalog, {
        type: "hostless-package", name: "Ant Design 6", codeName: "antd6",
        codeLink: "https://github.com/shiguang-lab/plasmic/tree/master/plasmicpkgs/antd6",
        sectionLabel: "Design systems", isInstallOnly: true,
        imageUrl: "https://plasmic.studio.publib.cn/static/img/antd6.svg",
        projectId: [dependency.projectId],
        items: dependency.site.components.filter(c => !c.codeComponentMeta?.isContext).map(c => ({
          type: "hostless-component", componentName: c.name,
          displayName: c.codeComponentMeta?.displayName ?? c.name,
        })),
      }];
      await db.setDevFlagOverrides(JSON.stringify(flags));
      console.log(`Installed Ant Design 6: ${dependency.site.components.length} components, project ${dependency.projectId}`);
    });
  } finally { await con.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
