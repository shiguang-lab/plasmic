import type { PreviewPage } from "@plasmic-shared/preview";
import type { ComponentRenderData } from "@plasmicapp/loader-nextjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URI });

export interface Publication {
  projectId: string;
  code: string;
  version: string;
  entryPath: string;
  pages: PreviewPage[];
  bundle: ComponentRenderData["bundle"];
}

export async function getPublication(
  code: string,
): Promise<Publication | undefined> {
  if (!/^[\w-]{10}$/.test(code)) {
    return undefined;
  }
  const { rows } = await pool.query<Publication>(
    `SELECT publication."projectId", "code", "version", "entryPath", "pages", "bundle"
    FROM "preview_publication" publication JOIN "project" ON "project"."id" = publication."projectId"
    WHERE "code" = $1 AND "enabled" = true AND "bundle" IS NOT NULL
      AND "project"."deletedAt" IS NULL AND "project"."permanentlyDeletedAt" IS NULL`,
    [code],
  );
  return rows[0];
}

export async function checkDatabase() {
  await pool.query('SELECT 1 FROM "preview_publication" LIMIT 0');
}
