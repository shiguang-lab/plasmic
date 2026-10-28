import CopilotMsg from "@/wab/client/components/CopilotMsg";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultCopilotPromptDialogProps,
  PlasmicCopilotPromptDialog,
} from "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicCopilotPromptDialog";
import { Tooltip } from "antd";
import * as React from "react";

import {
  CopilotData,
  useCopilot,
} from "@/wab/client/components/copilot/useCopilot";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import { isSubmitKeyCombo } from "@/wab/client/shortcuts/shortcut";
import { CopilotPrompt, CopilotType } from "@/wab/client/studio-ctx/StudioCtx";
import cn from "classnames";

export interface CopilotPromptDialogProps<
  Response,
> extends DefaultCopilotPromptDialogProps {
  type: CopilotType;
  maxLength?: number;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onCopilotSubmit: (args: CopilotPrompt) => Promise<CopilotData<Response>>;
  onCopilotApply: (newValue: Response) => void;
}

function CopilotPromptDialog<Response>({
  onCopilotApply,
  type,
  className,
  dialogOpen,
  onDialogOpenChange,
  maxLength,
  onCopilotSubmit,
}: CopilotPromptDialogProps<Response>) {
  const { t: uiT } = useI18n();
  const [showHistory, setShowHistory] = React.useState(false);
  const [copilotPrompt, setCopilotPrompt] = React.useState<CopilotPrompt>({
    prompt: "",
    images: [],
  });

  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);
  useAutoFocus(dialogOpen && promptInputRef);

  const {
    response,
    displayMessage,
    suggestionHistory,
    copilotInteractionId,
    state,
    submitPrompt,
  } = useCopilot<Response>({
    type,
    showHistory,
    onCopilotSubmit,
  });

  const isValidPrompt = copilotPrompt.prompt.trim() && state !== "loading";

  const applyResponse = (historyResponse: Response) => {
    onCopilotApply(historyResponse);
    onDialogOpenChange?.(false);
    setShowHistory(false);
  };

  return (
    <PlasmicCopilotPromptDialog
      type={type}
      promptInput={{
        imageUploadIcon: { render: () => null },
        imageUploadContainer: { render: () => null },
        runPromptBtn: {
          props: {
            onClick: () => submitPrompt(copilotPrompt),
            disabled: !isValidPrompt,
          },
          wrap: (elt) => (
            <Tooltip title={uiT("Run Plasmic AI")} mouseEnterDelay={0.5}>
              <TriggerTarget>{elt}</TriggerTarget>
            </Tooltip>
          ),
        },
        textAreaInput: {
          value: copilotPrompt.prompt,
          maxLength,
          rows: 1,
          autoFocus: true,
          onChange: (e) =>
            setCopilotPrompt({
              ...copilotPrompt,
              prompt: e.target.value,
            }),
          onKeyDown: async (e) => {
            if (isValidPrompt && isSubmitKeyCombo(e)) {
              e.preventDefault();
              await submitPrompt(copilotPrompt);
            }
          },
        },
      }}
      history={{
        style: {
          fontSize: 16,
        },
      }}
      rootContainer={{
        render: ({ className: rootClassname, children }) =>
          dialogOpen ? (
            <div className={cn(rootClassname, className)}>{children}</div>
          ) : null,
      }}
      cancelBtn={{
        onClick: () => {
          setShowHistory(false);
          onDialogOpenChange?.(false);
        },
        tooltip: uiT("Close"),
      }}
      historyBtn={{
        onClick: () => setShowHistory(!showHistory),
        tooltip: showHistory
          ? "Close suggestion history"
          : uiT("Suggestion history"),
      }}
      historyContents={{
        children: suggestionHistory.map(
          ({
            prompt: historyPrompt,
            response: historyResponse,
            displayMessage: historyDisplayMessage,
            id,
          }) => (
            <>
              <CopilotMsg userPrompt prompt={historyPrompt} />
              <CopilotMsg
                rightMargin
                code={historyDisplayMessage}
                key={id}
                copilotInteractionId={id}
                applyBtn={{
                  onClick: () => applyResponse(historyResponse),
                  onKeyPress: (e) => {
                    if (e.key === "Enter") {
                      applyResponse(historyResponse);
                    }
                  },
                }}
              />
            </>
          ),
        ),
      }}
      promptDialog={{
        style: {
          // We copy the box shadow from antd to inside the sizer container
          boxShadow:
            "0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
        },
      }}
      {...(dialogOpen
        ? state !== "ready"
          ? {
              state,
            }
          : (() => {
              return {
                state: "ready",
                ...(response
                  ? {
                      reply: {
                        props: {
                          key: copilotInteractionId,
                          applyBtn: {
                            onClick: () => applyResponse(response),
                            onKeyPress: (e) => {
                              if (e.key === "Enter") {
                                applyResponse(response);
                              }
                            },
                          },
                          copilotInteractionId: copilotInteractionId,
                          code: displayMessage,
                        },
                      },
                    }
                  : {
                      reply: {
                        render: () => null,
                      },
                    }),
              };
            })()
        : {})}
    />
  );
}

export { CopilotPromptDialog };
