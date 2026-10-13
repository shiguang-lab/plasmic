import {
  getLocalAiConfig,
  getLocalAiModels,
} from "@/wab/server/copilot/local-edit";
import { getUser, userDbMgr } from "@/wab/server/routes/util";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import {
  localAiStatusSchema,
} from "@/wab/shared/copilot/local-edit";
import { Request, Response } from "express-serve-static-core";

async function authorize(req: Request) {
  getUser(req);
  if (!req.devflags.enableLocalAiEditing) {
    throw new ForbiddenError("Local AI editing is disabled.");
  }
  await userDbMgr(req).checkProjectPerms(
    req.params.projectId,
    "viewer",
    "read AI service status",
  );
}

export async function localAiStatus(req: Request, res: Response) {
  await authorize(req);
  const config = getLocalAiConfig();
  res.json(
    localAiStatusSchema.parse({
      configured: !!config,
      model: config?.model ?? null,
      models: await getLocalAiModels(),
      pageGenerationEnabled: !!req.devflags.enableLocalAiPageGeneration,
    }),
  );
}
