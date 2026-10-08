import type { NextApiRequest, NextApiResponse } from "next";
import { checkDatabase } from "../../lib/publications";
export default async function healthcheck(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    await checkDatabase();
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
}
