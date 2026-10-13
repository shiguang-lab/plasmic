import { AppCtx } from "@/wab/client/app-ctx";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { getLocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { useI18n } from "@/wab/client/i18n";
import { CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import { createStyles } from "antd-style";
import * as React from "react";

const useStyles = createStyles(() => ({
  position: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: 530,
    maxWidth: "calc(100% - 32px)",
    zIndex: 1000,
    "@media (max-width: 1100px)": { bottom: 84 },
  },
}));

export function CanvasAiComposer({
  appCtx,
  projectId,
  context,
  onSubmit,
  hiddenByModal,
}: {
  appCtx: AppCtx;
  projectId: string;
  context: LocalAiContext;
  onSubmit: (opts: CopilotChatOpenOpts) => Promise<void>;
  hiddenByModal: boolean;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const session = React.useMemo(
    () => getLocalEditSession(projectId),
    [projectId],
  );
  React.useSyncExternalStore(session.subscribe, session.snapshot);
  const enabled = appCtx.appConfig.enableLocalAiEditing;
  const { data: status } = useLocalAiStatus(projectId, enabled);
  const activeTask = session.tasks.find((task) => task.status === "running");
  const attachmentState = useAiAttachments(
    session.draft.attachments,
    (attachments) => {
      session.draft = { ...session.draft, attachments };
    },
  );
  const open = () => {
    if (
      !enabled ||
      !context.binding ||
      !session.draft.prompt.trim() ||
      attachmentState.reading
    ) {
      return;
    }
    void onSubmit({
      prompt: session.draft.prompt.trim(),
      mode: undefined,
      attachments: session.draft.attachments,
      localEditBinding: context.binding,
    });
  };
  return (
    <div
      className={styles.position}
      style={{ visibility: hiddenByModal ? "hidden" : undefined }}
    >
      <AiComposer
        value={session.draft.prompt}
        onChange={(prompt) => {
          session.draft = { ...session.draft, prompt };
        }}
        onSubmit={open}
        attachmentState={attachmentState}
        scope={context.scope ?? t("Current page")}
        models={status?.models}
        model={session.selectedModel ?? status?.model}
        onModelChange={(model) => {
          session.selectedModel = model;
        }}
        disabled={!enabled}
        running={session.running}
        onStop={() => session.stop()}
        stopDisabled={!activeTask || !session.canStop(activeTask)}
        canSubmit={enabled && !!context.binding}
        placeholder={
          !context.binding
            ? t("Create or select a page before using AI.")
            : t("Describe changes to the current page…")
        }
        ariaLabel={t("AI canvas editing")}
        testId="canvas-ai-composer"
        availability={
          !enabled
            ? t("Local AI editing is disabled.")
            : !context.binding
              ? t("Create or select a page before using AI.")
              : undefined
        }
      />
    </div>
  );
}
