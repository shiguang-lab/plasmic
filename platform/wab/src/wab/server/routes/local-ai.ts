import {
  generateLocalEditStep,
  getLocalAiConfig,
} from "@/wab/server/copilot/local-edit";
import { getUser, userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError, ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import { localEditRequestSchema } from "@/wab/shared/copilot/local-edit";
import { Request, Response } from "express-serve-static-core";

async function authorize(req: Request) {
  getUser(req);
  if (!req.devflags.enableLocalAiEditing) {
    throw new ForbiddenError("Local AI editing is disabled.");
  }
  await userDbMgr(req).checkProjectPerms(
    req.params.projectId,
    "editor",
    "edit with AI",
  );
}

export async function localAiStatus(req: Request, res: Response) {
  await authorize(req);
  const config = getLocalAiConfig();
  res.json({ configured: !!config, model: config?.model ?? null });
}

export async function localAiStep(req: Request, res: Response) {
  await authorize(req);
  const parsed = localEditRequestSchema.safeParse(req.body);
  if (
    !parsed.success ||
    parsed.data.binding.projectId !== req.params.projectId ||
    JSON.stringify(req.body).length > 1000000
  ) {
    throw new BadRequestError("Invalid local AI editing request.");
  }
  if (res.destroyed || req.aborted) {
    return;
  }
  const controller = new AbortController();
  const abort = () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  res.on("close", abort);
  try {
    const result = await generateLocalEditStep(parsed.data, controller.signal);
    if (!controller.signal.aborted) {
      res.json(result);
    }
  } catch {
    // Provider errors can echo credentials or request data. Keep them out of Web responses.
    if (!controller.signal.aborted) {
      res
        .status(502)
        .json({
          error: {
            message:
              "AI service request failed. Check the server model configuration or try again.",
          },
        });
    }
  } finally {
    res.off("close", abort);
  }
}
