import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Client } from "pg";

async function main() {
  const password = process.env.TEMPORAL_POSTGRES_PASSWORD;
  if (!password || !process.env.DATABASE_URI || !process.env.AI_CHAT_BUCKET) {
    throw new Error(
      "DATABASE_URI, TEMPORAL_POSTGRES_PASSWORD and AI_CHAT_BUCKET are required",
    );
  }
  const db = new Client({ connectionString: process.env.DATABASE_URI });
  await db.connect();
  try {
    const role = await db.query(
      "SELECT 1 FROM pg_roles WHERE rolname='temporal_ai'",
    );
    if (!role.rowCount) {
      await db.query(
        `CREATE ROLE temporal_ai LOGIN PASSWORD '${password.replace(/'/g, "''")}'`,
      );
    }
    for (const name of ["temporal_ai", "temporal_ai_visibility"]) {
      const existing = await db.query(
        "SELECT 1 FROM pg_database WHERE datname=$1",
        [name],
      );
      if (!existing.rowCount) {
        await db.query(`CREATE DATABASE ${name} OWNER temporal_ai`);
      }
      const uri = new URL(process.env.DATABASE_URI);
      uri.pathname = `/${name}`;
      const temporalDb = new Client({ connectionString: uri.href });
      await temporalDb.connect();
      try {
        await temporalDb.query("ALTER SCHEMA public OWNER TO temporal_ai");
        if (name === "temporal_ai_visibility") {
          await temporalDb.query("CREATE EXTENSION IF NOT EXISTS btree_gin");
        }
      } finally {
        await temporalDb.end();
      }
    }
  } finally {
    await db.end();
  }
  const storage = new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  });
  try {
    try {
      await storage.send(
        new HeadBucketCommand({ Bucket: process.env.AI_CHAT_BUCKET }),
      );
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
      await storage.send(
        new CreateBucketCommand({ Bucket: process.env.AI_CHAT_BUCKET }),
      );
    }
  } finally {
    storage.destroy();
  }
  console.log("Temporal databases and private AI chat bucket are ready");
}

main().catch(() => {
  console.error(
    "AI infrastructure initialization failed; check database and storage access",
  );
  process.exitCode = 1;
});
