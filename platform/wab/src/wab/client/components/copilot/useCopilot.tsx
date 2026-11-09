import { useAsyncFnStrict } from "@/wab/client/hooks/useAsyncStrict";
import { CopilotPrompt, CopilotType } from "@/wab/client/studio-ctx/StudioCtx";
import { useCopilotHistory } from "@/wab/client/studio-ctx/copilot-state";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { trackEvent } from "@/wab/client/tracking";
import { CopilotInteractionId } from "@/wab/shared/ApiSchema";

export interface CopilotData<R> {
  displayMessage: string | undefined;
  response: R | undefined;
  copilotInteractionId: CopilotInteractionId | undefined;
  // metadata for trackCopilotQuery
  context?: string;
  currentValue?: string;
  data?: any;
}

interface UseCopilotProps<Response> {
  showHistory: boolean;
  type: CopilotType;
  onCopilotSubmit: (args: CopilotPrompt) => Promise<CopilotData<Response>>;
}

type CopilotState =
  | "loading"
  | "error"
  | "ready"
  | "quotaExceeded"
  | "history"
  | "historyEmpty";

export function useCopilot<Response>({
  showHistory,
  type,
  onCopilotSubmit,
}: UseCopilotProps<Response>) {
  const studioCtx = useStudioCtx();

  const [copilotResponse, submitPrompt] = useAsyncFnStrict(
    (copilotPrompt: CopilotPrompt) => onCopilotSubmit(copilotPrompt)
      .then((result) => {
        const { response, displayMessage, copilotInteractionId, data, context, currentValue } = result;
        if (response && copilotInteractionId) {
          studioCtx.addToCopilotHistory(type, {
            prompt: copilotPrompt.prompt,
            response,
            displayMessage,
            id: copilotInteractionId,
          });
        }
        trackCopilotQuery({ data, context, currentValue, prompt: copilotPrompt.prompt, result: JSON.stringify(response) });
        return result;
      })
      .catch((err) => {
        if (err.name === "CopilotRateLimitExceededError") {
          return "CopilotRateLimitExceededError" as const;
        }
        throw err;
      }),
  );

  const suggestionHistory = useCopilotHistory<Response>(studioCtx, type);

  const state: CopilotState = showHistory
    ? suggestionHistory.length > 0
      ? "history"
      : "historyEmpty"
    : copilotResponse.loading
      ? "loading"
      : copilotResponse.error !== undefined
        ? "error"
        : copilotResponse.value === "CopilotRateLimitExceededError"
          ? "quotaExceeded"
          : "ready";

  const copilotData =
    copilotResponse.value &&
    copilotResponse.value !== "CopilotRateLimitExceededError"
      ? copilotResponse.value
      : undefined;

  return {
    state,
    suggestionHistory,
    submitPrompt,
    copilotInteractionId: copilotData?.copilotInteractionId,
    displayMessage: copilotData?.displayMessage,
    response: copilotData?.response,
  };
}

function trackCopilotQuery({
  prompt,
  context,
  currentValue,
  data,
  result,
}: {
  prompt: string;
  context: string | undefined;
  currentValue: string | undefined;
  data: any;
  result: string | undefined;
}) {
  const truncateCode = (code: string | undefined) =>
    code &&
    (code.length <= 500
      ? code
      : `${code.slice(0, 250)}\n// ...\n${code.slice(-250)}`);
  trackEvent("Run Copilot query", {
    prompt,
    context,
    currentCode: truncateCode(currentValue),
    env:
      data && typeof data === "object"
        ? JSON.stringify(
            Object.entries(data).map(([k, v]) =>
              k.startsWith("$") && v && typeof v === "object"
                ? [k, Object.keys(v)]
                : [k, typeof v],
            ),
            undefined,
            2,
          )
        : undefined,
    result: truncateCode(result),
  });
}
