import { CopilotToolCallResult } from "@/wab/client/frame-ctx/host-frame-api";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { formatErrorMessage } from "@/wab/shared/error-handling";
import { useEffect } from "react";

export type PlasmicAiTools = {
  _meta: ReturnType<typeof mapCopilotToolsToJsonSchema>;
  _getLocalContext: () => Promise<CopilotToolCallResult>;
  _executeLocal: (
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<CopilotToolCallResult>;
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
    const enqueue = (
      name: string,
      input: Record<string, unknown>,
      signal?: AbortSignal,
      outputFormat?: "json",
    ) => {
      const call = (
        name === "getEditorContext" ? Promise.resolve() : pending
      ).then(async (): Promise<CopilotToolCallResult> => {
        try {
          if (!active) {
            throw new Error(
              "This project session has closed; reconnect to the open project.",
            );
          }
          await hostFrameApi.waitForStudioReady();
          signal?.throwIfAborted();
          if (!active) {
            throw new Error(
              "This project session has closed; reconnect to the open project.",
            );
          }
          return outputFormat
            ? await hostFrameApi.executeCopilotToolCall(
                name,
                input,
                outputFormat,
              )
            : await hostFrameApi.executeCopilotToolCall(name, input);
        } catch (error) {
          return {
            success: false,
            error: {
              type: "EXECUTION_FAILED",
              message: formatErrorMessage(error),
            },
          };
        }
      });
      if (name !== "getEditorContext") {
        pending = call.then(
          () => undefined,
          () => undefined,
        );
      }
      return call;
    };
    const tools = Object.fromEntries(
      Object.keys(PROTOTYPE_TOOL_META).map((name) => [
        name,
        (input: Record<string, unknown>) => enqueue(name, input),
      ]),
    );
    const api = {
      ...tools,
      _meta: mapCopilotToolsToJsonSchema(PROTOTYPE_TOOL_META),
      _getLocalContext: () =>
        enqueue("getEditorContext", {}, undefined, "json"),
      _executeLocal: (input: Record<string, unknown>, signal?: AbortSignal) =>
        enqueue("executeLocalEdit", input, signal),
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
