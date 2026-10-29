import { loadConfig } from "@/wab/server/config";
import {
  closeDbConnections,
  ensureDbConnection,
  ensureDbConnections,
  getDefaultConnection,
} from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import {
  PlatformLibraryReport,
  analyzePlatformLibraries,
  describeBlockers,
  describeDroppedArgs,
  enablePlatformLibraries,
  upgradePlatformLibraryConsumers,
} from "@/wab/server/db/platform-libraries";
import { promises as fs } from "fs";

const USAGE = `Usage: nas-platform-libraries.ts <command> [--report <file>]

  status   Read-only. Lists platform libraries and the projects an upgrade changes.
  enable   Moves platform libraries into the platform library workspace and
           turns on automatic upgrades. Refuses when a project cannot be upgraded.
           --accept-dropped-args  Accept removing settings of params that the
                                  latest libraries no longer declare.
  upgrade  Upgrades existing projects to the latest platform libraries.

Stop the server before enable/upgrade, and start it afterwards so it loads the
new dev flags.`;

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printReport(report: PlatformLibraryReport) {
  console.log(`Platform library workspace: ${report.workspaceId ?? "not configured"}`);
  console.log(`Automatic upgrades: ${report.autoUpgradeHostless ? "on" : "off"}`);
  for (const lib of report.libraries) {
    console.log(
      `  ${lib.name}@${lib.latestVersion} project ${lib.projectId}` +
        `${lib.workspaceId === report.workspaceId && report.workspaceId ? "" : " (outside the workspace)"}` +
        `${lib.hasLatestArtifact ? "" : " (latest version has no code artifact; website publishing will fail)"}`,
    );
  }
  for (const lib of report.retired) {
    console.log(`  ${lib.name}@${lib.latestVersion} retired, not upgraded`);
  }
  for (const project of report.foreignWorkspaceProjects) {
    console.log(`  NOT ALLOWED in workspace: ${project.name} (${project.projectId}): ${project.reason}`);
  }
  for (const entry of report.catalogMismatches) {
    console.log(`  catalog ${entry.codeName}: hasCodeArtifacts ${entry.hasCodeArtifacts} → ${entry.expected}`);
  }
  console.log(`Scanned ${report.scanned} revisions and versions; ${report.consumers.length} import older platform library versions.`);
  for (const consumer of report.consumers) {
    console.log(
      `  ${consumer.name} (${consumer.label}): ${consumer.upgrades
        .map((u) => `${u.library} ${u.from} → ${u.to}`)
        .join(", ")}`,
    );
  }
  const dropped = describeDroppedArgs(report);
  if (dropped.length) {
    console.log("Settings removed because the latest library no longer declares the param:");
    dropped.forEach((line) => console.log(`  ${line}`));
  }
  const blockers = describeBlockers(report);
  if (blockers.length) {
    console.log("Upgrade blockers:");
    blockers.forEach((line) => console.log(`  ${line}`));
  }
}

async function writeReport(data: unknown) {
  const file = option("--report");
  if (file) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    console.log(`Report written to ${file}`);
  }
}

async function main() {
  const command = process.argv[2];
  const uri = loadConfig().databaseUri;
  if (command === "status") {
    const con = await ensureDbConnection(uri, "default");
    try {
      const report = await analyzePlatformLibraries(new DbMgr(con.manager, SUPER_USER));
      printReport(report);
      await writeReport(report);
    } finally {
      await con.close();
    }
  } else if (command === "enable") {
    const con = await ensureDbConnection(uri, "default");
    try {
      const result = await con.transaction((em) =>
        enablePlatformLibraries(em, {
          acceptDroppedArgs: process.argv.includes("--accept-dropped-args"),
        }),
      );
      printReport(result.report);
      console.log(`Enabled workspace ${result.workspaceId}; moved: ${result.moved.join(", ") || "none"}`);
      console.log("Next: run upgrade, then start the server.");
      await writeReport(result);
    } finally {
      await con.close();
    }
  } else if (command === "upgrade") {
    await ensureDbConnections(uri);
    try {
      const db = new DbMgr((await getDefaultConnection()).manager, SUPER_USER);
      const { results } = await upgradePlatformLibraryConsumers(db, (line) => console.log(line));
      const failed = results.filter((r) => r.status === "failed");
      console.log(`Upgraded ${results.length - failed.length}; failed ${failed.length}.`);
      await writeReport(results);
      if (failed.length) {
        process.exitCode = 1;
      }
    } finally {
      await closeDbConnections();
    }
  } else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
