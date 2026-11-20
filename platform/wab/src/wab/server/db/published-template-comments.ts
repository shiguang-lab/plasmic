import { getMigratedBundle } from "@/wab/server/db/BundleMigrator";
import type { DbMgr } from "@/wab/server/db/DbMgr";
import { getPublishedTemplateVersion } from "@/wab/server/db/published-template";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";
import type { CommentLocation } from "@/wab/shared/ApiSchema";
import { memoize } from "lodash";

export async function publishedCommentLocations(
  mgr: DbMgr,
  projectId: string,
  version: string,
) {
  const current = await getPublishedTemplateVersion(mgr, projectId);
  if (current.published.version !== version) {
    throw new BadRequestError(
      "The published template changed. Reopen it to view its comments.",
    );
  }
  const bundle = await getMigratedBundle(current.version);
  const dependency = memoize(async (id: string) =>
    getMigratedBundle(await mgr.getPkgVersionById(id)),
  );
  return async (location: CommentLocation) => {
    const subject = location?.subject;
    const type = subject?.uuid === projectId && bundle.map[subject.iid]?.__type;
    if (
      (type !== "TplComponent" && type !== "TplTag") ||
      !Array.isArray(location.variants)
    ) {
      return false;
    }
    for (const addr of location.variants) {
      const owner =
        addr?.uuid === projectId
          ? bundle
          : addr && bundle.deps.includes(addr.uuid)
            ? await dependency(addr.uuid)
            : undefined;
      if (owner?.map[addr.iid]?.__type !== "Variant") {
        return false;
      }
    }
    return true;
  };
}
