import { loadConfig } from "@/wab/server/config";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER, normalActor } from "@/wab/server/db/DbMgr";
import { PkgMgr, getBundleInfo } from "@/wab/server/pkg-mgr";
import { initializeGlobals } from "@/wab/server/svr-init";
import { defaultComponentKinds } from "@/wab/shared/core/components";
import { DEVFLAGS } from "@/wab/shared/devflags";
import {
  PLEXUS_INSERTABLE_ID,
  PLUME_INSERTABLE_ID,
} from "@/wab/shared/insertables";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { kebabCase, startCase } from "lodash";

initializeGlobals();

async function main() {
  if (!process.env.SG_BOOTSTRAP_SUB) {
    throw new Error("SG_BOOTSTRAP_SUB is required.");
  }
  const config = loadConfig();
  const con = await ensureDbConnection(config.databaseUri, "default");
  try {
    // Never import/call upstream initDb(): it TRUNCATEs the org table.
    // Refuse any database with application rows, including a partially seeded one.
    const tables: { tablename: string }[] = await con.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
    );
    for (const { tablename } of tables) {
      const ident = '"' + tablename.replace(/"/g, '""') + '"';
      const rows = await con.query(`SELECT 1 FROM ${ident} LIMIT 1`);
      if (rows.length) {
        throw new Error(`拒绝初始化：${tablename} 已有数据。`);
      }
    }
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      region: "us-east-1",
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    try {
      await s3.send(new HeadBucketCommand({ Bucket: "plasmic-site-assets" }));
    } catch (e: any) {
      if (e.$metadata?.httpStatusCode !== 404) {
        throw e;
      }
      await s3.send(new CreateBucketCommand({ Bucket: "plasmic-site-assets" }));
    } finally {
      s3.destroy();
    }
    await con.runMigrations({ transaction: "all" });
    await con.transaction(async (em) => {
      const db = new DbMgr(em, SUPER_USER);
      const user = await db.getUserById(process.env.SG_BOOTSTRAP_SUB!);
      await db.ensurePersonalWorkspace(user);
      // Packages must be seeded after the first user (upstream ownership rule).
      for (const name of [PLUME_INSERTABLE_ID, PLEXUS_INSERTABLE_ID]) {
        await new PkgMgr(db, name).seedPkg(user.id);
      }
      const plexus = getBundleInfo(PLEXUS_INSERTABLE_ID);
      await db.setDevFlagOverrides(
        JSON.stringify({
          defaultHostUrl: process.env.REACT_APP_DEFAULT_HOST_URL,
          codegenOriginHost: process.env.CODEGEN_HOST,
          enablePlasmicHosting: false,
          previewOrigin: process.env.PREVIEW_ORIGIN ?? "https://preview.plasmic.shiguanglab.com",
          enableChatCopilot: false,
          freeTier: { ...DEVFLAGS.freeTier, maxUsers: null },
          plexus: true,
          installables: [
            {
              type: "ui-kit",
              isInstallOnly: true,
              name: "Plasmic Design System",
              projectId: plexus.projectId,
              entryPoint: { type: "arena", name: "Components" },
            },
          ],
          insertableTemplates: {
            type: "insertable-templates-group",
            name: "root",
            items: [
              {
                type: "insertable-templates-group",
                name: "Components",
                items: Object.keys(defaultComponentKinds).map((item) => ({
                  type: "insertable-templates-component",
                  componentName: startCase(item),
                  templateName: `plexus/${kebabCase(item)}`,
                  projectId: plexus.projectId,
                  tokenResolution: "reuse-by-name",
                })),
              },
            ],
          },
          insertPanelContent: {
            aliases: {
              dataFetcher: "builtincc:plasmic-data-source-fetcher",
              pageMeta: "builtincc:hostless-plasmic-head",
              ...Object.fromEntries(
                Object.keys(defaultComponentKinds).map((k) => [
                  k,
                  `default:${k}`,
                ]),
              ),
            },
            builtinSections: {
              Home: {
                Basic: [
                  "text",
                  "heading",
                  "link",
                  "section",
                  "columns",
                  "vstack",
                  "hstack",
                  "grid",
                  "box",
                  "image",
                  "icon",
                ],
                "Customizable components": Object.keys(defaultComponentKinds),
                Advanced: ["pageMeta", "dataFetcher"],
              },
            },
          },
        }),
      );
      const owner = new DbMgr(em, normalActor(user.id));
      const team = await owner.createTeam("Shiguang");
      await owner.createWorkspace({
        name: "产品原型",
        description: "B 端原型评审",
        teamId: team.id,
      });
    });
    console.log("初始化完成；使用拾光用户 ID 创建组件包和业务工作区。");
  } finally {
    await con.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
