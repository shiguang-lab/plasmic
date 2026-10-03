import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { CopilotToolCallResult } from "@/wab/client/frame-ctx/host-frame-api";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { formatErrorMessage } from "@/wab/shared/error-handling";
import { useEffect } from "react";

export type PlasmicAiTools = {
  _meta: ReturnType<typeof mapCopilotToolsToJsonSchema>;
} & {
  [K in keyof typeof PROTOTYPE_TOOL_META]: (
    input: Record<string, unknown>,
  ) => Promise<CopilotToolCallResult>;
};

declare global {
  interface Window {
    PLASMIC_AI_TOOLS?: PlasmicAiTools;
  }
}

/** Expose only the validated editor tools, through the existing cross-frame RPC. */
export function TopFrameCopilotToolsBridge() {
  const { hostFrameApi, hostFrameApiReady } = useTopFrameCtx();
  useEffect(() => {
    if (!hostFrameApiReady) {
      return;
    }
    // A single queue prevents simultaneous agent requests from racing editor transactions.
    let pending = Promise.resolve();
    let active = true;
    const tools = Object.fromEntries(
      Object.keys(PROTOTYPE_TOOL_META).map((name) => [
        name,
        (input: Record<string, unknown>) => {
          const call = pending.then(
            async (): Promise<CopilotToolCallResult> => {
              try {
                if (!active) {
                  throw new Error(
                    "This project session has closed; reconnect to the open project.",
                  );
                }
                await hostFrameApi.waitForStudioReady();
                return await hostFrameApi.executeCopilotToolCall(name, input);
              } catch (error) {
                return {
                  success: false,
                  error: {
                    type: "EXECUTION_FAILED",
                    message: formatErrorMessage(error),
                  },
                };
              }
            },
          );
          pending = call.then(
            () => undefined,
            () => undefined,
          );
          return call;
        },
      ]),
    );
    const api = {
      ...tools,
      _meta: mapCopilotToolsToJsonSchema(PROTOTYPE_TOOL_META),
    } as PlasmicAiTools;
    window.PLASMIC_AI_TOOLS = api;
    return () => {
      active = false;
      if (window.PLASMIC_AI_TOOLS === api) {
        delete window.PLASMIC_AI_TOOLS;
      }
    };
  }, [hostFrameApi, hostFrameApiReady]);
  return null;
}
