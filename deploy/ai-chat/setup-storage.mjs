import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../platform/wab/package.json", import.meta.url),
);
const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");
const client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:8333",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local-ai-storage",
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY ?? "local-ai-storage-secret",
  },
});
try {
  await client.send(
    new CreateBucketCommand({
      Bucket: process.env.AI_CHAT_BUCKET ?? "plasmic-ai-chat",
    }),
  );
  console.log("Private AI chat bucket created");
} catch (error) {
  if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name))
    throw error;
} finally {
  client.destroy();
}
