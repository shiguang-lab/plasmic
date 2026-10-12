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
  res.json({
    configured: !!config,
    model: config?.model ?? null,
    pageGenerationEnabled: !!req.devflags.enableLocalAiPageGeneration,
  });
}

export async function localAiStep(req: Request, res: Response) {
  await authorize(req);
  const parsed = localEditRequestSchema.safeParse(req.body);
  if (
    !parsed.success ||
    parsed.data.binding.projectId !== req.params.projectId ||
    !parsed.data.binding.componentUuid ||
    JSON.stringify(req.body).length >
      (parsed.data.binding.mode === "page" ? 2000000 : 1000000)
  ) {
    throw new BadRequestError("Invalid local AI editing request.");
  }
  if (
    parsed.data.binding.mode === "page" &&
    !req.devflags.enableLocalAiPageGeneration
  ) {
    throw new ForbiddenError("AI page generation is disabled.");
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
  // JSON permits leading whitespace. Keep the single JSON response alive
  // through idle proxies while the provider is composing a page.
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Content-Encoding", "identity");
  const heartbeat = setInterval(() => {
    if (!controller.signal.aborted && !res.destroyed && !res.writableEnded) {
      res.write("\n");
    }
  }, 10000);
  const finish = (result: unknown, status = 200) => {
    if (res.headersSent) {
      res.end(JSON.stringify(result));
    } else {
      res.status(status).json(result);
    }
  };
  try {
    const result = await generateLocalEditStep(parsed.data, controller.signal);
    if (!controller.signal.aborted) {
      finish(result);
    }
  } catch {
    // Provider errors can echo credentials or request data. Keep them out of Web responses.
    if (!controller.signal.aborted) {
      finish(
        {
          error: {
            message:
              "AI service request failed. Check the server model configuration or try again.",
          },
        },
        502,
      );
    }
  } finally {
    clearInterval(heartbeat);
    res.off("close", abort);
  }
}
