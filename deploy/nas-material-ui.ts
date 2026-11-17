import { loadConfig } from "@/wab/server/config";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { publishHostlessProject } from "@/wab/server/db/PublishHostless";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
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
      const existing = catalog.find(
        (entry) => entry.codeName === "material-ui",
      );
      const bundler = new Bundler();
      const pkg = existing
        ? ensure(
            await db.getPkgByProjectId(
              ensure(
                ensureArray(existing.projectId)[0],
                "Missing Material UI project",
              ),
            ),
            "Missing Material UI package",
          )
        : undefined;
      if (pkg) {
        await publishHostlessProject(db, pkg.projectId, {
          breaking: process.argv.includes("--breaking"),
        });
      }
      const dependency = pkg
        ? await unbundlePkgVersion(db, bundler, await db.getPkgVersion(pkg.id))
        : await db.createHostLessProject(
            new HostLessPackageInfo({
              name: "material-ui",
              npmPkg: ["@shiguang-lab/plasmic-material-ui"],
              cssImport: [],
              deps: [],
              registerCalls: [],
              minimumReactVersion: "19.3.1",
            }),
            bundler,
          );
      await db.updateProject({
        id: dependency.projectId,
        readableByPublic: true,
      });
      // Studio loads the stored code of the installed version only when it exists.
      const libraryPkg = ensure(
        await db.getPkgByProjectId(dependency.projectId),
        "Missing Material UI package",
      );
      const libraryVersion = await db.getPkgVersion(
        libraryPkg.id,
        dependency.version,
      );
      const hasCodeArtifacts = !!(await em.findOne(HostlessLibraryVersion, {
        pkgVersionId: libraryVersion.id,
      }));
      const imageUrl =
        "https://plasmic-studio.shiguanglab.com/static/img/material-ui.svg";
      const entry: CatalogPackage = {
        type: "hostless-package",
        name: "Material UI",
        codeName: "material-ui",
        hasCodeArtifacts,
        codeLink:
          "https://github.com/shiguang-lab/plasmic/tree/master/plasmicpkgs/material-ui",
        projectId: [dependency.projectId],
        sectionLabel: "Design systems",
        imageUrl,
        isInstallOnly: true,
        isHeaderLess: true,
        items: [
          {
            type: "hostless-component",
            componentName: "material-ui-library",
            displayName: "Material UI",
            imageUrl,
          },
        ],
      };
      flags.hostLessComponents = [
        ...catalog.filter((item) => item.codeName !== "material-ui"),
        entry,
      ];
      await db.setDevFlagOverrides(JSON.stringify(flags));
      console.log(
        `Registered Material UI: ${dependency.site.components.length} components, project ${dependency.projectId}`,
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
