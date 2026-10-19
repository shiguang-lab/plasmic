import { NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { getCodegenUrl } from "@/wab/shared/urls";
import type { Request, Response } from "express-serve-static-core";
import fs from "fs";
import path from "path";

function getHydrationScriptInfo() {
  const dir = path.resolve(process.cwd(), "../loader-html-hydrate/build");
  const files = fs.readdirSync(dir).filter((file) => /^loader-hydrate\.[\da-f]+\.js$/.test(file));
  if (files.length !== 1) {
    throw new Error("Expected exactly one versioned hydration script");
  }
  return { dir, filename: files[0], hash: files[0].split(".")[1] };
}

export function getHydrationScript(_: Request, res: Response) {
  res.setHeader("Cache-Control", "max-age=60, s-maxage=60");
  res.redirect(`${getCodegenUrl()}/static/js/${getHydrationScriptInfo().filename}`);
}

export function getHydrationScriptVersioned(req: Request, res: Response) {
  const { dir, filename, hash } = getHydrationScriptInfo();
  if (hash !== req.params.hash) {
    throw new NotFoundError(`Hydration script with hash=${req.params.hash} is unavailable`);
  }
  res.setHeader("Cache-Control", "max-age=31536000, s-maxage=31536000");
  res.sendFile(path.join(dir, filename));
}
